/* Bộ máy dựng trang bài học THCS từ dữ liệu window.LESSON (do Database/tools/tao-bai.py ghi vào trang).
   LESSON = {id, grade, unit, title, vi, emoji, book, note,
             vocab:[{w,pos,ipa,vi,pic|emo,ex,exVi}],
             grammar:[{title, exp(HTML), forms:[...], examples:[{en,vi}]}],
             dialog:{title, people:{A,B}, lines:[{who:'A'|'B', en, vi}]},
             reading:{title, en:[đoạn], vi:[đoạn]}  (tuỳ chọn),
             quiz:[{q, opts:[...], a:chỉ_số_đúng, why}]}
   Cần nạp trước: ../config.js, common/tracker.js, common/practice.js, common/games.js.
   Thang điểm 10: Từ vựng 1 · Hội thoại/Bài đọc 1 · Trò chơi 1+1 · Bài tập 3 (bắt buộc) · Luyện nghe 1,5 · Luyện nói 1,5. */
(function () {
  var L = window.LESSON;
  var TK = window.Tracker;
  if (!L) return;

  /* ---------- tiện ích ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function attr(s) { return esc(s).replace(/'/g, '&#39;'); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pic(v) { return v.pic ? '<img src="' + attr(v.pic) + '" alt="' + attr(v.w) + '" loading="lazy">' : esc(v.emo || '📘'); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- giọng đọc ---------- */
  var synth = window.speechSynthesis, voice = null;
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices().filter(function (v) { return /^en[-_]/i.test(v.lang); });
    voice = vs.filter(function (v) { return /en[-_]US/i.test(v.lang) && /Google|Natural|Aria|Jenny|Samantha/i.test(v.name); })[0] ||
      vs.filter(function (v) { return /en[-_]US/i.test(v.lang); })[0] || vs[0] || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  var warned = false;
  function speak(text, o) {
    o = o || {};
    if (!synth) { if (!warned) { warned = true; toast('Máy này chưa có giọng đọc tiếng Anh. Hãy mở bằng Chrome hoặc Edge.', 'try'); } return; }
    if (!o.queue) synth.cancel();
    var u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = (window.Practice ? Practice.getRate() : 0.9) * (o.rateMul || 1);
    if (o.onstart) u.onstart = o.onstart;
    if (o.onend) u.onend = o.onend;
    synth.speak(u);
  }

  /* ---------- hiệu ứng ---------- */
  var ac = null;
  function tone(freqs) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach(function (f, i) {
        var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.09;
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.2);
      });
    } catch (e) {}
  }
  var toastT = 0;
  function toast(msg, kind) {
    var t = $('.toast') || document.body.appendChild(document.createElement('div'));
    t.className = 'toast ' + (kind || ''); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function confetti() {
    var cols = ['#3D5AFE', '#12946A', '#FFD166', '#D3344E', '#8E7CFF'];
    for (var i = 0; i < 40; i++) {
      var c = document.createElement('i'); c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length];
      c.style.animationDelay = Math.random() * 0.6 + 's';
      document.body.appendChild(c); setTimeout(function (x) { x.remove(); }.bind(null, c), 2600);
    }
  }
  var SKEY = 'stars:' + L.id;
  function stars() { return parseInt(store(SKEY), 10) || 0; }
  function addStars(n) { store(SKEY, stars() + n); var s = $('#starN'); if (s) s.textContent = stars(); }
  var FX = { yay: function () { tone([660, 880]); }, oops: function () { tone([220]); }, toast: toast, confetti: confetti, addStars: addStars };

  /* ---------- khung trang ---------- */
  var SECTIONS = [
    ['vocab', 'Từ vựng'], ['grammar', 'Ngữ pháp'], ['dialog', L.reading ? 'Hội thoại & Bài đọc' : 'Hội thoại'],
    ['games', 'Trò chơi'], ['quiz', 'Bài tập'], ['listen', 'Luyện nghe'], ['speak', 'Luyện nói'], ['score', 'Chấm điểm']
  ];
  var app = $('#app');
  app.innerHTML =
    '<header class="bar"><div class="wrap"><a class="home" id="homeLink" href="../index.html">🏠 <span>Trang chủ</span></a>' +
    '<span class="t">Lớp ' + L.grade + ' · Unit ' + L.unit + ': ' + esc(L.title) + '</span>' +
    '<button class="chipbtn" id="speedBtn" type="button">🚶 Vừa</button>' +
    '<span class="stars">⭐ <span id="starN">' + stars() + '</span></span></div></header>' +
    '<main class="wrap">' +
    '<div class="hero"><span class="kick">Lớp ' + L.grade + ' · Unit ' + L.unit + '</span>' +
    '<h1>' + esc(L.emoji || '') + ' ' + esc(L.title) + '</h1><p class="sub">' + esc(L.vi) + '</p>' +
    (L.note ? '<p class="note">📘 ' + L.note + '</p>' : '') +
    '<nav class="toc">' + SECTIONS.map(function (s, i) { return '<a href="#s-' + s[0] + '">' + (i + 1) + '. ' + s[1] + '</a>'; }).join('') + '</nav></div>' +
    SECTIONS.map(function (s, i) {
      return '<section class="box" id="s-' + s[0] + '"><h2><span class="n">' + (i + 1) + '</span>' + s[1] + '</h2><div class="body"></div></section>';
    }).join('') +
    '</main><footer>Tiếng Anh THCS · Ảnh minh hoạ: Microsoft Fluent Emoji (MIT) · <a href="../ket-qua.html">Xem kết quả học</a></footer>';
  function body(id) { return $('#s-' + id + ' .body'); }
  if (window.Practice) Practice.mountRateButton($('#speedBtn'));

  if (TK) TK.init({
    id: L.id, topic: L.grade * 100 + L.unit, title: 'Lớp ' + L.grade + ' · Unit ' + L.unit + ': ' + L.title,
    activities: [
      { id: 'vocab', label: 'Nghe từ vựng', weight: 1 },
      { id: 'dialog', label: L.reading ? 'Hội thoại & bài đọc' : 'Hội thoại', weight: 1 },
      { id: 'game1', label: 'Trò chơi 1', weight: 1, required: true },
      { id: 'game2', label: 'Trò chơi 2', weight: 1 },
      { id: 'quiz', label: 'Bài tập', weight: 3, required: true },
      { id: 'listen', label: 'Luyện nghe', weight: 1.5 },
      { id: 'speak', label: 'Luyện nói', weight: 1.5 }
    ]
  });
  function mark(id, r, t) { if (TK) TK.mark(id, r, t); }

  /* ---------- 1. Từ vựng ---------- */
  var heard = {};
  (function () {
    var b = body('vocab');
    b.innerHTML = '<p class="lead">Bấm vào thẻ để nghe từ, bấm 🔊 cạnh câu ví dụ để nghe cả câu. Nghe đủ ' + L.vocab.length + ' từ để được điểm phần này.</p>' +
      '<div class="tools"><button class="btn" id="playAll">▶ Nghe lần lượt tất cả</button></div>' +
      '<div class="vgrid">' + L.vocab.map(function (v, i) {
        return '<div class="vcard" data-i="' + i + '"><button class="vpic" data-w="' + i + '" aria-label="Nghe ' + attr(v.w) + '">' + pic(v) + '</button>' +
          '<div class="vw">' + esc(v.w) + (v.pos ? '<small>(' + esc(v.pos) + ')</small>' : '') + '</div>' +
          '<div class="ipa">' + esc(v.ipa) + '</div><div class="vi">' + esc(v.vi) + '</div>' +
          (v.ex ? '<div class="vex"><button class="spk" data-x="' + i + '" aria-label="Nghe câu ví dụ">🔊</button><div><p>' + esc(v.ex) + '</p><p class="vi">' + esc(v.exVi) + '</p></div></div>' : '') +
          '</div>';
      }).join('') + '</div>';
    function hear(i) {
      heard[i] = 1; b.querySelector('.vcard[data-i="' + i + '"]').classList.add('heard');
      var n = Object.keys(heard).length;
      mark('vocab', n / L.vocab.length, 'Đã nghe ' + n + '/' + L.vocab.length + ' từ');
      if (n === L.vocab.length && !hear.done) { hear.done = 1; toast('Đã nghe hết từ vựng! 👏', 'good'); addStars(1); }
    }
    b.addEventListener('click', function (e) {
      var w = e.target.closest('[data-w]'), x = e.target.closest('[data-x]');
      if (w) { var i = +w.getAttribute('data-w'); speak(L.vocab[i].w); hear(i); }
      if (x) speak(L.vocab[+x.getAttribute('data-x')].ex);
    });
    $('#playAll').addEventListener('click', function () {
      if (synth) synth.cancel();
      L.vocab.forEach(function (v, i) {
        speak(v.w, { queue: true, onstart: function () { hear(i); b.querySelector('.vcard[data-i="' + i + '"]').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
      });
    });
  })();

  /* ---------- 2. Ngữ pháp ---------- */
  (function () {
    var b = body('grammar');
    b.innerHTML = '<p class="lead">Đọc phần giải thích, xem công thức rồi bấm 🔊 nghe câu ví dụ.</p>' +
      (L.grammar || []).map(function (g, gi) {
        return '<div class="gblock"><h3>' + esc(g.title) + '</h3><div class="exp">' + (g.exp || '') + '</div>' +
          (g.forms && g.forms.length ? '<div class="forms">' + g.forms.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join('') + '</div>' : '') +
          '<ul class="exl">' + (g.examples || []).map(function (x, xi) {
            return '<li><button class="spk" data-g="' + gi + '-' + xi + '" aria-label="Nghe">🔊</button><div><p>' + esc(x.en) + '</p><p class="vi">' + esc(x.vi) + '</p></div></li>';
          }).join('') + '</ul></div>';
      }).join('');
    b.addEventListener('click', function (e) {
      var g = e.target.closest('[data-g]'); if (!g) return;
      var p = g.getAttribute('data-g').split('-'); speak(L.grammar[+p[0]].examples[+p[1]].en);
    });
  })();

  /* ---------- 3. Hội thoại & bài đọc ---------- */
  (function () {
    var b = body('dialog'), D = L.dialog, seen = {}, readDone = !L.reading;
    var ppl = (D && D.people) || { A: 'A', B: 'B' };
    var html = '';
    if (D) {
      html += '<p class="lead">' + esc(D.title || '') + ' — bấm từng câu để nghe, hoặc nghe cả đoạn. Bấm "Hiện nghĩa" khi cần.</p>' +
        '<div class="tools"><button class="btn" id="dlgAll">▶ Nghe cả đoạn hội thoại</button><button class="btn ghost" id="dlgVi">👁 Hiện nghĩa</button></div>' +
        '<div class="dialog">' + D.lines.map(function (l, i) {
          return '<div class="line ' + l.who + '"><span class="av">' + esc(String(ppl[l.who] || l.who).slice(0, 2)) + '</span>' +
            '<div class="bub" data-l="' + i + '"><div class="who">' + esc(ppl[l.who] || l.who) + '</div><p class="en">' + esc(l.en) + '</p><p class="vi" hidden>' + esc(l.vi) + '</p></div></div>';
        }).join('') + '</div>';
    }
    if (L.reading) {
      html += '<div class="reading"><h3>📖 ' + esc(L.reading.title) + '</h3>' +
        L.reading.en.map(function (p) { return '<p class="en">' + esc(p) + '</p>'; }).join('') +
        '<div class="tools"><button class="btn" id="rdPlay">▶ Nghe bài đọc</button><button class="btn ghost" id="rdVi">👁 Xem bản dịch</button></div>' +
        '<div class="vi" id="rdViBox" hidden>' + L.reading.vi.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div></div>';
    }
    b.innerHTML = html;
    function upd() {
      var n = D ? Object.keys(seen).length : 0, t = D ? D.lines.length : 0;
      var r = ((t ? n / t : 1) + (readDone ? 1 : 0)) / 2;
      mark('dialog', r, (t ? 'Nghe ' + n + '/' + t + ' câu hội thoại' : '') + (L.reading ? (readDone ? ' · đã nghe bài đọc' : ' · chưa nghe bài đọc') : ''));
    }
    function sayLine(i, queue) {
      var el = b.querySelector('.bub[data-l="' + i + '"]');
      speak(D.lines[i].en, {
        queue: queue, onstart: function () { b.querySelectorAll('.bub.on').forEach(function (x) { x.classList.remove('on'); }); el.classList.add('on'); seen[i] = 1; upd(); },
        onend: function () { el.classList.remove('on'); }
      });
    }
    b.addEventListener('click', function (e) {
      var l = e.target.closest('.bub'); if (l) sayLine(+l.getAttribute('data-l'));
    });
    if (D) {
      $('#dlgAll').addEventListener('click', function () { if (synth) synth.cancel(); D.lines.forEach(function (_, i) { sayLine(i, true); }); });
      $('#dlgVi').addEventListener('click', function () {
        var vs = b.querySelectorAll('.dialog .vi'), show = vs[0] && vs[0].hidden;
        vs.forEach(function (v) { v.hidden = !show; }); this.textContent = show ? '🙈 Ẩn nghĩa' : '👁 Hiện nghĩa';
      });
    }
    if (L.reading) {
      $('#rdPlay').addEventListener('click', function () {
        if (synth) synth.cancel();
        L.reading.en.forEach(function (p, i) { speak(p, { queue: true, rateMul: 0.95, onend: i === L.reading.en.length - 1 ? function () { readDone = true; upd(); } : null }); });
        setTimeout(function () { readDone = true; upd(); }, 8000);
      });
      $('#rdVi').addEventListener('click', function () { var v = $('#rdViBox'); v.hidden = !v.hidden; });
    }
  })();

  /* ---------- 4. Trò chơi ---------- */
  (function () {
    var b = body('games');
    b.innerHTML = '<p class="lead">Hai trò chơi giúp nhớ từ: lật thẻ tìm cặp hình – chữ, và xếp chữ cái thành từ.</p><div class="games"><div id="game1"></div><div id="game2"></div></div>';
    if (!window.Games) return;
    var items = L.vocab.map(function (v) { return { w: v.w, e: pic(v), vi: v.vi }; });
    var spellItems = shuffle(items.filter(function (it) { return it.w.replace(/[^a-z]/gi, '').length <= 12; }));
    var G = [
      { type: 'memory', title: 'Lật thẻ tìm cặp', icon: '🃏', how: 'Lật hai thẻ: một hình và một từ tiếng Anh. Tìm đủ các cặp khớp nhau.', items: items },
      { type: 'spell', title: 'Xếp chữ thành từ', icon: '🔤', how: 'Nghe từ, nhìn hình và nghĩa, rồi chạm các chữ cái theo đúng thứ tự.', items: spellItems, rounds: 6 }
    ];
    G.forEach(function (g, i) {
      g.speak = speak; g.fx = FX;
      g.onDone = function (r, t) { mark('game' + (i + 1), r, t); };
      Games.mount($('#game' + (i + 1)), g);
    });
  })();

  /* ---------- 5. Bài tập ---------- */
  (function () {
    var b = body('quiz');
    function build() {
      var V = L.vocab, qs = [];
      shuffle(V).slice(0, 4).forEach(function (v) {
        qs.push({ pic: v, q: 'Hình này là từ nào?', opts: shuffle([v.w].concat(shuffle(V.filter(function (x) { return x !== v; })).slice(0, 3).map(function (x) { return x.w; }))), ans: v.w });
      });
      shuffle(V).slice(0, 3).forEach(function (v) {
        qs.push({ q: 'Từ tiếng Anh của “' + v.vi + '” là gì?', opts: shuffle([v.w].concat(shuffle(V.filter(function (x) { return x !== v; })).slice(0, 3).map(function (x) { return x.w; }))), ans: v.w });
      });
      (L.quiz || []).forEach(function (q) { qs.push({ q: q.q, opts: q.opts.slice(), ans: q.opts[q.a], why: q.why }); });
      return qs;
    }
    function render() {
      var qs = build(), done = 0, right = 0;
      b.innerHTML = '<p class="lead">' + qs.length + ' câu: từ vựng và ngữ pháp của Unit. Chọn một đáp án, máy chấm ngay.</p><div class="qlist">' +
        qs.map(function (q, i) {
          return '<div class="q" data-q="' + i + '"><div class="qh"><span class="num">Câu ' + (i + 1) + '.</span>' +
            (q.pic ? '<span class="pic">' + pic(q.pic) + '</span>' : '') + '<span>' + esc(q.q) + '</span></div>' +
            '<div class="opts">' + q.opts.map(function (o) { return '<button class="opt" data-o="' + attr(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
            '<p class="why" hidden></p></div>';
        }).join('') + '</div><p class="qscore" id="qscore"></p><div class="tools"><button class="btn ghost" id="qAgain">🔄 Làm lại với câu hỏi mới</button></div>';
      b.querySelectorAll('.q').forEach(function (el) {
        var q = qs[+el.getAttribute('data-q')];
        el.addEventListener('click', function (e) {
          var o = e.target.closest('.opt'); if (!o || o.disabled) return;
          var ok = o.getAttribute('data-o') === q.ans;
          el.querySelectorAll('.opt').forEach(function (x) { x.disabled = true; if (x.getAttribute('data-o') === q.ans) x.classList.add('ok'); });
          if (!ok) o.classList.add('bad');
          var w = el.querySelector('.why');
          if (q.why) { w.textContent = (ok ? '✅ ' : '❌ ') + q.why; w.hidden = false; }
          if (ok) { right++; FX.yay(); } else FX.oops();
          if (/^[A-Za-z]/.test(q.ans) && q.ans.split(' ').length <= 3) speak(q.ans);
          done++;
          $('#qscore').textContent = 'Đúng ' + right + '/' + done + ' câu' + (done < qs.length ? ' (còn ' + (qs.length - done) + ' câu)' : '.');
          if (done === qs.length) {
            mark('quiz', right / qs.length, right + '/' + qs.length + ' câu đúng');
            addStars(Math.max(1, Math.round(right / qs.length * 3)));
            if (right === qs.length) { confetti(); toast('Đúng hết! Xuất sắc! 🏆', 'good'); }
            else toast('Đúng ' + right + '/' + qs.length + ' câu', right / qs.length >= 0.7 ? 'good' : 'try');
          }
        });
      });
      $('#qAgain').addEventListener('click', render);
    }
    render();
  })();

  /* ---------- 6 + 7. Luyện nghe, luyện nói ---------- */
  var SENT = [];
  L.vocab.forEach(function (v) { if (v.ex) SENT.push({ en: v.ex, ipa: '', vi: v.exVi }); });
  (L.grammar || []).forEach(function (g) { (g.examples || []).forEach(function (x) { SENT.push({ en: x.en, ipa: '', vi: x.vi }); }); });
  if (L.dialog) L.dialog.lines.forEach(function (l) { SENT.push({ en: l.en, ipa: '', vi: l.vi }); });
  (function () {
    body('listen').innerHTML = '<p class="lead">Nghe câu rồi xếp các từ theo đúng thứ tự. Có thể chỉnh tốc độ đọc.</p><div id="listenBox"></div>';
    body('speak').innerHTML = '<p class="lead">Nghe mẫu, bấm thu âm rồi đọc to. Máy chấm phát âm (dùng tốt nhất trên Chrome/Edge có micro).</p><div id="speakBox"></div>';
    if (!window.Practice) return;
    Practice.mountListening($('#listenBox'), {
      items: SENT, count: 5, speak: speak,
      onDone: function (c, n) { mark('listen', c / n, 'Xếp đúng ' + c + '/' + n + ' câu'); if (c === n) confetti(); }
    });
    Practice.mountSpeaking($('#speakBox'), {
      words: L.vocab.map(function (v) { return { en: v.w, ipa: v.ipa, vi: v.vi, e: pic(v) }; }), sentences: SENT, speak: speak,
      onDone: function (avg, said, n) { mark('speak', avg, 'Đã nói ' + said + '/' + n + ' câu · đúng ' + Math.round(avg * 100) + '%'); }
    });
  })();

  /* ---------- 8. Chấm điểm ---------- */
  (function () {
    body('score').innerHTML = '<p class="lead">Làm xong các phần rồi bấm nộp bài. Điểm được lưu trên máy và hiện ở trang Kết quả.</p><div id="scorePanel"></div>';
    if (TK) TK.mount($('#scorePanel'));
  })();
})();
