#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convert_weici_to_watchdict.py
将「维克多 高考词汇」版本3（docs/3，每个单词一个 .md）转换为
「腕上词典」(weardict) 的离线词库格式（app 实际读取约定）：

    common/dict/dic_<T>.bin          —— 整个词典一个文件（T=a 完整库 / T=b 简库）
    common/dict/dic_<T>_<L>_map.bin  —— 首字母 L 的索引，JSON={第二字母:[[字节长,字节偏移]]}

    app 检索：英文搜索只读 dic_<T>_<首字母>_map.bin；中文搜索按字母 a..z 依次读 26 个 map。
    A 库（5 字段）：word|part|mean|ex|tran
         word 单词；part 词性；mean 释义(含音标+中文)；ex 英文例句；tran 例句翻译
    B 库（2 字段）：word|mean

用法：
    python3 convert_weici_to_watchdict.py \
        --src  weici/docs/3 \
        --out  dict_out \
        [--max-ex 2]          # 每个词最多保留几句例句
        [--words a,b,c]       # 可选：只处理指定首字母（调试）
输出到 --out 下：
    dict_a/  dict_b/  各自含 dic_a.bin、dic_b.bin 与 26 个 *_map.bin
"""

import os
import re
import sys
import json
import argparse
from collections import OrderedDict

# ---------- 字段清洗 ----------
def clean(text):
    """去掉 markdown/HTML 残留、折叠空白、替换会破坏分隔的字符。"""
    if not text:
        return ""
    text = text.strip()
    # 去掉行内 markdown 强调与音标标记
    text = re.sub(r'\*\*', '', text)
    text = re.sub(r'\*', '', text)
    text = re.sub(r'`', '', text)
    # 去掉音频/HTML 标签
    text = re.sub(r'<audio[^>]*>.*?</audio>', '', text, flags=re.S)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    # 分隔符保护：'|' 会破坏 app 的 split('|')，换成全角
    text = text.replace('|', '｜')
    return text


def first_letter(word):
    """首字母（仅英文小写 a-z）；非英文开头归到 'a'。"""
    for ch in word:
        if ch.isalpha():
            return ch.lower()
    return 'a'


def second_letter(word):
    """第二字母（app 的 getSecondLetter 逻辑：非字母/缺失 -> 'a'）。"""
    if len(word) >= 2 and word[1].isalpha():
        return word[1].lower()
    return 'a'


# ---------- 解析单个 .md ----------
def parse_word_md(path):
    """返回 dict(word=..., part=..., phonetic=..., mean_list=[...], ex_list=[...], tran_list=[...])"""
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')

    result = {
        'word': '',
        'part_list': [],   # 词性（可能多个，如 prep/adv）
        'phonetic': '',
        'mean_list': [],   # 中文释义（多个）
        'ex_list': [],     # 英文例句
        'tran_list': [],   # 例句翻译
    }

    in_sense = False       # 是否在"英文释义"含义块内（用于收集例句对）
    in_fixed = False       # 是否在"固定搭配"内
    last_gt_en = None      # 上一个 > 行是否为英文（用于配对）

    for raw in lines:
        line = raw.rstrip('\n')
        stripped = line.strip()

        # 词头 + 词性（同一文件可能多个词头，如 about: prep/adv）
        m = re.match(r'^#\s+\*\*\*\\#(.*?)\*\*\*\s*(.*)$', stripped)
        if m:
            result['word'] = clean(m.group(1))
            part = clean(m.group(2)).replace('重难点词汇', '').strip()
            for p in re.split(r'[、/；; ]+', part):
                p = p.strip()
                if p and p not in result['part_list']:
                    result['part_list'].append(p)
            continue

        # 英音音标
        m = re.match(r'^英音\s*([^\s].*)$', stripped)
        if m and not result['phonetic']:
            p = m.group(1).strip()
            # 去掉可能附带的 '英音' 字样
            p = re.sub(r'^英音\s*', '', p)
            result['phonetic'] = p.strip()
            continue

        # 章节切换
        if stripped.startswith('英文释义'):
            in_sense, in_fixed = True, False
            continue
        if stripped.startswith('固定搭配'):
            in_sense, in_fixed = False, True
            continue
        if stripped.startswith('真题解析') or stripped.startswith('派生词汇') or stripped.startswith('词语辨析'):
            in_sense, in_fixed = False, False

        # 含义行：### N.*高义频/低义频：* **中文**   或  ### N.**中文**（词组/特殊词）
        m = re.match(r'^###\s+\d+\..*?\*\*(.*?)\*\*\s*$', stripped)
        if m and in_sense:
            meaning = clean(m.group(1))
            meaning = re.sub(r'^(高义频|低义频)[：:]\s*', '', meaning)
            meaning = re.sub(r'[：:]\s*$', '', meaning).strip()
            if meaning and meaning not in result['mean_list']:
                result['mean_list'].append(meaning)
            continue

        # 固定搭配内的含义（## 或数字标题行）——不作为主释义，但可补充
        # 例句对：> 英文  +  下一行 > 中文
        if stripped.startswith('>'):
            content = clean(stripped[1:])
            if not content:
                last_gt_en = None
                continue
            # 判断是否为中文（含较多 CJK 字符）
            cjk = sum(1 for ch in content if '\u4e00' <= ch <= '\u9fff')
            if cjk >= 2 and last_gt_en is not None:
                # 这是上一条英文例句的翻译
                if result['ex_list'] and result['ex_list'][-1] == last_gt_en and \
                        (len(result['tran_list']) < len(result['ex_list'])):
                    result['tran_list'].append(content)
                last_gt_en = None
            else:
                # 英文例句（含 中文 的混合行也算中文处理，避免误判）
                result['ex_list'].append(content)
                last_gt_en = content
            continue

        # 非 > 行会打断英文-中文配对
        if stripped and not stripped.startswith('<audio'):
            # 但空行和纯数字/标记不打断对
            pass

    return result


# ---------- 生成 A 库 / B 库 ----------
def write_dict(outdir, master):
    """写出 app 真实格式：

      dic_<T>.bin        = 整个词典（T=a 或 b）一个文件，按 首字母->第二字母 连续存放
      dic_<T>_<L>_map.bin = 每首字母 26 个索引文件，JSON = {第二字母: [[字节长,字节偏移]]}

    master: dict[first_letter] -> {second_letter: [rec,...]}，rec 已按字母序排序。
    """
    os.makedirs(outdir, exist_ok=True)
    binpath = os.path.join(outdir, 'dic_a.bin' if outdir.endswith('dict_a') else 'dic_b.bin')
    letter_maps = {}

    with open(binpath, 'w', encoding='utf-8') as f:
        offset = 0
        for L in 'abcdefghijklmnopqrstuvwxyz':
            sub = master.get(L)
            if not sub:
                letter_maps[L] = {}
                continue
            idx = {}
            for SL in sorted(sub.keys()):
                segment = '|'.join(sub[SL])
                seg_bytes = (segment + '|').encode('utf-8')
                idx[SL] = [[len(seg_bytes), offset]]
                f.write(segment + '|')
                offset += len(seg_bytes)
            letter_maps[L] = idx

    # 每首字母写 26 个索引文件（a..z 同名全写，内容为该首字母的第二字母索引）
    for L in 'abcdefghijklmnopqrstuvwxyz':
        mm = os.path.join(outdir, 'dic_%s_%s_map.bin' % ('a' if outdir.endswith('dict_a') else 'b', L))
        with open(mm, 'w', encoding='utf-8') as f:
            json.dump(letter_maps[L], f, ensure_ascii=False)

    return binpath


def gather_word_files(src):
    """收集 docs/3 下所有词条 .md：A-Z 字母目录 + _special_word + _word_group。"""
    files = []  # (letter, abspath)
    skip = {'README.md', '_sidebar.md', 'README'}
    for root, dirs, fns in os.walk(src):
        for fn in fns:
            if not fn.endswith('.md') or fn in skip:
                continue
            word = fn[:-3]
            if word in skip:
                continue
            letter = first_letter(word)
            files.append((letter, os.path.join(root, fn)))
    return files


def main():
    global args
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--max-ex', type=int, default=2)
    ap.add_argument('--words', default='')  # 调试：只处理这些首字母，逗号分隔
    args = ap.parse_args()

    src = args.src
    out = args.out

    files = gather_word_files(src)
    if args.words:
        keep = set(x.lower() for x in args.words.split(','))
        files = [f for f in files if f[0] in keep]

    by_letter = {}
    for letter, abspath in files:
        by_letter.setdefault(letter, []).append(abspath)

    master_a = {}   # L -> {SL: [rec_a]}  5字段
    master_b = {}   # L -> {SL: [rec_b]}  2字段
    total = 0

    for letter in sorted(by_letter.keys()):
        words = []
        for abspath in by_letter[letter]:
            try:
                parsed = parse_word_md(abspath)
            except Exception as e:
                print('  parse err', os.path.basename(abspath), e)
                continue
            if not parsed['word']:
                parsed['word'] = os.path.basename(abspath)[:-3]
            words.append(parsed)

        # 去重（同词只留一个）
        seen = set()
        uniq = []
        for w in words:
            k = w['word'].lower()
            if k in seen:
                continue
            seen.add(k)
            uniq.append(w)
        words = uniq
        words = sorted(words, key=lambda w: (w['word'].lower(), w['word']))

        # 分组：首字母 letter -> 第二字母 -> [rec]
        ma = master_a.setdefault(letter, {})
        mb = master_b.setdefault(letter, {})
        for w in words:
            word = w['word']
            part = '；'.join(w['part_list']) or ''
            phon = w['phonetic'].strip()
            meanings = w['mean_list']
            mean = ('[' + phon + '] ' if phon else '') + ('；'.join(meanings) if meanings else '')
            mean = clean(mean)
            exs = w['ex_list'][:args.max_ex]
            trans = w['tran_list'][:len(exs)]
            ex = clean('；'.join(exs))
            tran = clean('；'.join(trans))
            rec_a = '|'.join([word, part, mean, ex, tran])
            rec_b = '|'.join([word, mean])
            SL = second_letter(word)
            ma.setdefault(SL, []).append(rec_a)
            mb.setdefault(SL, []).append(rec_b)
            total += 1

        print('letter %s: %d words' % (letter, len(words)))

    bp = write_dict(os.path.join(out, 'dict_a'), master_a)
    bpB = write_dict(os.path.join(out, 'dict_b'), master_b)
    print('A=%s(%.2fMB)  B=%s(%.2fMB)' % (
        bp, os.path.getsize(bp)/1e6, bpB, os.path.getsize(bpB)/1e6))
    print('总词条:', total)
    print('done ->', out)


if __name__ == '__main__':
    main()
