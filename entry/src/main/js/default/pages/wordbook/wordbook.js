import router from '../../common/router.js';
import fs from '../../common/fs.js';
import common from '../../common/common.js';
import storage from '@system.storage';

let working_uri = "internal://app/wordbook";
let wordbook = [];          // list.json 原始条目 [词,[首,次],type]
let all_notes = [];         // 已读取的全部词条对象（含 words/part/mean/showMean/wbIndex）
let loadedCount = 0;        // 已异步加载完成的笔记数
let totalToLoad = 0;        // 需要加载的笔记总数
var index = 0;

// ---- 词性映射：维克多词典实际使用的全部词性（dic_a/dic_b 统计 + 常见变体）----
var POS_ORDER = {
    n: 0, noun: 0, "名词": 0,
    v: 1, vi: 1, vt: 1, verb: 1, "动词": 1,
    adj: 2, a: 2, "形容词": 2,
    adv: 3, ad: 3, "副词": 3,
    prep: 4, "介词": 4,
    conj: 5, "连词": 5,
    pron: 6, "代词": 6,
    num: 7, "数词": 7,
    art: 8, "冠词": 8,
    int: 9, interj: 9, "感叹词": 9,
    modal: 10, "情态动词": 10,
    aux: 11, auxv: 11, "助动词": 11,
    abbr: 12, "缩写": 12,
    prefix: 13, "前缀": 13,
    phr: 14, "短语": 14,
    det: 15, "限定词": 15,
    suffix: 16, "后缀": 16
};
// 词性 key -> 中文标签（仅用于显示）
var POS_LIST = [
    { key: 0, header: '名词' },
    { key: 1, header: '动词' },
    { key: 2, header: '形容词' },
    { key: 3, header: '副词' },
    { key: 4, header: '介词' },
    { key: 5, header: '连词' },
    { key: 6, header: '代词' },
    { key: 7, header: '数词' },
    { key: 8, header: '冠词' },
    { key: 9, header: '感叹词' },
    { key: 10, header: '情态动词' },
    { key: 11, header: '助动词' },
    { key: 12, header: '缩写' },
    { key: 13, header: '前缀' },
    { key: 14, header: '短语' },
    { key: 15, header: '限定词' },
    { key: 16, header: '后缀' },
    { key: 90, header: '其他' },
    { key: 99, header: '未分类' }
];
function posHeaderOf(key) {
    for (var i = 0; i < POS_LIST.length; i++) {
        if (POS_LIST[i].key === key) return POS_LIST[i].header;
    }
    return '其他';
}

// 去掉括号注释，如 "n (pl.)" -> "n "（不用正则，Lite 快照 profile 不支持 RegExp）
function stripParens(s) {
    var out = '';
    var depth = 0;
    for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (ch === '(' || ch === '（') { depth++; continue; }
        if (ch === ')' || ch === '）') { if (depth > 0) depth--; continue; }
        if (depth === 0) out += ch;
    }
    return out;
}
// 按“；;、/ 空格 &”切分成多段（不用正则）
function splitAll(s) {
    var out = [];
    var start = 0;
    var i;
    for (i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (ch === '；' || ch === ';' || ch === '、' || ch === '/' || ch === ' ' || ch === '&') {
            out.push(s.substring(start, i));
            start = i + 1;
        }
    }
    out.push(s.substring(start));
    return out;
}
// 返回一个词的所有词性组号（多词性可命中多个组，已去重）
function posGroupList(part) {
    if (!part) return [99];
    var segs = splitAll(stripParens(part));
    var out = [];
    for (var i = 0; i < segs.length; i++) {
        var main = segs[i].trim().toLowerCase();
        if (main.charAt(main.length - 1) === '.') main = main.substring(0, main.length - 1);
        if (main === 'vt' || main === 'vi') main = 'v';
        if (main === 'a') main = 'adj';
        if (main === 'ad') main = 'adv';
        if (POS_ORDER.hasOwnProperty(main)) {
            if (out.indexOf(POS_ORDER[main]) === -1) out.push(POS_ORDER[main]);
        } else {
            if (out.indexOf(90) === -1) out.push(90);
        }
    }
    if (out.length === 0) out.push(99);
    return out;
}

// ---- 一级：词性分组列表 [{key, header, count}]，只保留收藏里有词的词性 ----
var groups = [];
// ---- 二级：当前词性下的词条（同一词可出现在多个词性组）----
var groupWords = [];

function buildGroups() {
    // 统计每个词的所有词性（一个词可同时计入多个组）
    var counts = {};
    var keys = [];
    var i;
    for (i = 0; i < all_notes.length; i++) {
        var gs = posGroupList(all_notes[i].part);
        for (var j = 0; j < gs.length; j++) {
            var k = gs[j];
            if (counts[k] === undefined) { counts[k] = 0; keys.push(k); }
            counts[k]++;
        }
    }
    keys.sort(function (a, b) { return a - b; });
    groups.length = 0;
    for (i = 0; i < keys.length; i++) {
        groups.push({ key: keys[i], header: posHeaderOf(keys[i]), count: counts[keys[i]] });
    }
    // 全部词条按词字母序排好（组内即有序）
    all_notes.sort(function (a, b) {
        var wa = (a.words || '').toLowerCase();
        var wb = (b.words || '').toLowerCase();
        return wa < wb ? -1 : (wa > wb ? 1 : 0);
    });
}

function analyzeItem() {
    var item_uri = "";
    var obj;
    for (let i = 0, len = wordbook.length; i < len; i++) {
        if (wordbook[index] != undefined) {
            item_uri = working_uri + "/" + wordbook[index][1][0] + "/" + wordbook[index][0];
            (function (wbIdx) {
                fs.rawApi.readText({
                    uri: item_uri,
                    success: (data) => {
                        obj = JSON.parse(data.text);
                        data.text = null;
                        obj.showMean = obj.part + obj.mean;
                        obj.wbIndex = wbIdx;
                        all_notes.push(obj);
                        loadedCount++;
                        if (loadedCount >= totalToLoad) {
                            buildGroups();
                        }
                    }
                });
            })(index);
        }
        index++;
    }
    item_uri = null;
    obj = null;
}

fs.readLargeFile(working_uri + "/list.json", (err, data) => {
    if (err) {
        fs.printGeneralError(fs, data);
        return;
    }
    wordbook = JSON.parse(data);
    data = null;
    if (wordbook.length == 0) {
        return;
    }
    totalToLoad = wordbook.length;
    analyzeItem();
});

var deleteItem = -1;

export default {
    data: {
        showWord: false,        // false=词性列表，true=某词性下的单词列表
        groups: groups,
        groupWords: groupWords,
        currentPos: '',
        showDialog: false,
        totalCount: wordbook.length,
        moveY: -1,
        RounderBackgroundValue: {
            background: "transparent",
            radius: 0
        },
    },
    onInit() {
        this.getBackgroundSettings();
        common.clean();
    },
    getBackgroundSettings() {
        storage.get({
            key: 'RounderBackground',
            default: '0',
            success: (data) => {
                if (data == '1') {
                    this.RounderBackgroundValue.background = "rgb(36,36,36)";
                    this.RounderBackgroundValue.radius = 75;
                }
            }
        });
    },
    listRef() {
        return this.showWord ? 'listWord' : 'listPos';
    },
    onShow() {
        this.rotation(this.listRef(), true);
        if (this.showWord && this.moveY !== -1) {
            if (this.$refs.listWord.scrollBy) {
                this.$refs.listWord.scrollBy({
                    distance: -this.moveY
                });
            }
        }
    },
    onHide() {
        this.rotation(this.listRef(), false);
    },
    onDestroy() {
        wordbook = null;
        all_notes = null;
        groups = null;
        groupWords = null;
    },
    // 一级：点击某个词性，进入该词性下的单词列表
    enterPos(idx) {
        var g = this.groups[idx];
        if (!g) return;
        var target = g.key;
        var i;
        groupWords.length = 0;
        for (i = 0; i < all_notes.length; i++) {
            var gs = posGroupList(all_notes[i].part);
            for (var j = 0; j < gs.length; j++) {
                if (gs[j] === target) {
                    groupWords.push(all_notes[i]);
                    break;
                }
            }
        }
        this.currentPos = g.header;
        this.showWord = true;
    },
    // 二级：返回词性列表
    backToPos() {
        this.showWord = false;
        this.moveY = -1;
    },
    showdetails(index, event) {
        var offset = -1;
        if (event) {
            if (event.globalY < 160) offset += 1;
            if (event.globalY > 320) offset -= 1;
        }
        var note = this.groupWords[index];
        if (!note) return;
        let moveY = ((index + offset) * 160) + 100;
        common.writeMultiParams({
            result: note,
            searchType: note.type,
            moveY: moveY
        }, () => {
            router.push({
                uri: 'pages/show_word/show_word'
            });
        });
    },
    touchmove(e) {
        if (e.direction == 'right' && e.distance >= 150) {
            if (this.showWord) {
                this.backToPos();
            } else {
                router.back();
            }
        }
    },
    rotation(ref, value) {
        if (this.$refs[ref].rotation) {
            this.$refs[ref].rotation({
                focus: value
            });
        }
    },
    doNotPropagation(event) {
        event[event.StopPropagation ? "StopPropagation" : "stopPropagation"]();
    },
    dialogClick(event) {
        this.exitDialog();
        this.doNotPropagation(event);
    },
    handleDelete(index) {
        var note = this.groupWords[index];
        if (!note) return;
        deleteItem = index;
        this.rotation(this.listRef(), false);
        this.showDialog = true;
    },
    exitDialog() {
        deleteItem = -1;
        this.showDialog = false;
        this.rotation(this.listRef(), true);
    },
    dialogSwipe(e) {
        if (e.direction == "down" && (e.distance ? e.distance >= 80 : true)) {
            this.exitDialog();
        }
    },
    confirmDelete() {
        var note = this.groupWords[deleteItem];
        if (!note) return;
        var wbIdx = note.wbIndex;
        var delGs = posGroupList(note.part);
        groupWords.splice(deleteItem, 1);   // 即时从二级列表移除
        let then = () => {
            wordbook.splice(wbIdx, 1);
            fs.rawApi.writeText({
                uri: working_uri + "/list.json",
                text: JSON.stringify(wordbook)
            });
            // 从全部词条移除该条，并重算剩余 wbIndex
            var cnt = 0;
            var i;
            for (i = 0; i < all_notes.length; i++) {
                if (all_notes[i].wbIndex === wbIdx) {
                    all_notes.splice(i, 1);
                    i--;
                } else {
                    all_notes[i].wbIndex = cnt;
                    cnt++;
                }
            }
            // 该词涉及的所有词性组数量减一；减到 0 的分组从一级移除
            for (i = 0; i < groups.length; i++) {
                if (delGs.indexOf(groups[i].key) !== -1) {
                    groups[i].count--;
                    if (groups[i].count <= 0) {
                        groups.splice(i, 1);
                        i--;
                    }
                }
            }
            this.totalCount = wordbook.length;
            deleteItem = -1;
            setTimeout(() => {
                this.exitDialog();
                if (this.groupWords.length === 0) {
                    this.backToPos();
                }
            }, 100);
        };
        fs.rawApi.delete({
            uri: working_uri + "/" + wordbook[wbIdx][1][0] + "/" + wordbook[wbIdx][0],
            success: then
        });
    }
}
