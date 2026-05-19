/**
 * Classic podkidnoy Durak table: SVG cards, opponents, felt, deck + trump.
 * Drag-and-drop is only for cards (attack / throw-in / defend); other actions use buttons.
 * dataTransfer is mirrored to text/plain for browsers with limited custom MIME support.
 */
(function () {
  "use strict";

  var parts = location.pathname.split("/").filter(Boolean);
  var gameId = parts[parts.length - 1];
  var BASE = "/api/game/games/" + gameId + "/";

  var state = null;
  var profile = null;
  /** @type {Set<string>} */
  var selected = new Set();

  var SUIT_SYMBOL = {
    Hearts: "\u2665",
    Diamonds: "\u2666",
    Clubs: "\u2663",
    Spades: "\u2660",
  };

  function rankShort(rank) {
    var m = {
      Ace: "A",
      King: "K",
      Queen: "Q",
      Jack: "J",
      Ten: "10",
      Nine: "9",
      Eight: "8",
      Seven: "7",
      Six: "6",
      Five: "5",
      Four: "4",
      Three: "3",
      Two: "2",
    };
    return m[rank] || rank;
  }

  function isRedSuit(suit) {
    return suit === "Hearts" || suit === "Diamonds";
  }

  function suitNameEn(suit) {
    var m = { Hearts: "hearts", Diamonds: "diamonds", Clubs: "clubs", Spades: "spades" };
    return m[suit] || suit;
  }

  function phaseEn(phase) {
    var m = {
      between: "Break",
      build: "Table (attack & defense)",
      defend: "Table (legacy)",
    };
    return m[phase] || phase || "—";
  }

  /**
   * @param {{rank:string,suit:string}} card
   * @param {{mini?:boolean}} opts
   */
  function cardSvgOuterHTML(card, opts) {
    opts = opts || {};
    var mini = !!opts.mini;
    var ink = isRedSuit(card.suit) ? "#b71c1c" : "#212121";
    var sym = SUIT_SYMBOL[card.suit] || "?";
    var rnk = rankShort(card.rank);
    var vb = mini ? "0 0 58 80" : "0 0 76 104";
    var fsCorner = mini ? 10 : 11;
    var fsCenter = mini ? 28 : 36;
    var rw = mini ? 54 : 70;
    var rh = mini ? 76 : 98;
    var rx = mini ? 2 : 2;
    var ry = mini ? 2 : 2;
    var brRankX = mini ? 52 : 67;
    var brRankY = mini ? 72 : 93;
    var brSymX = mini ? 52 : 67;
    var brSymY = mini ? 59 : 77;
    var brSymFs = mini ? 10 : 11;

    return (
      '<svg class="play-card-svg" viewBox="' +
      vb +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" overflow="hidden">' +
      '<rect x="' +
      rx +
      '" y="' +
      ry +
      '" width="' +
      rw +
      '" height="' +
      rh +
      '" rx="5" fill="#faf8f5" stroke="#2c2c2c" stroke-width="1.2"/>' +
      '<text x="' +
      (mini ? 7 : 8) +
      '" y="' +
      (mini ? 17 : 20) +
      '" font-size="' +
      fsCorner +
      '" font-weight="700" fill="' +
      ink +
      '" font-family="Georgia,serif">' +
      rnk +
      "</text>" +
      '<text x="' +
      (mini ? 7 : 8) +
      '" y="' +
      (mini ? 31 : 36) +
      '" font-size="' +
      (mini ? 11 : 13) +
      '" fill="' +
      ink +
      '">' +
      sym +
      "</text>" +
      '<text x="' +
      (mini ? 29 : 37) +
      '" y="' +
      (mini ? 49 : 64) +
      '" font-size="' +
      fsCenter +
      '" text-anchor="middle" fill="' +
      ink +
      '">' +
      sym +
      "</text>" +
      '<text x="' +
      brSymX +
      '" y="' +
      brSymY +
      '" font-size="' +
      brSymFs +
      '" text-anchor="end" fill="' +
      ink +
      '">' +
      sym +
      "</text>" +
      '<text x="' +
      brRankX +
      '" y="' +
      brRankY +
      '" font-size="' +
      fsCorner +
      '" font-weight="700" fill="' +
      ink +
      '" font-family="Georgia,serif" text-anchor="end">' +
      rnk +
      "</text>" +
      "</svg>"
    );
  }

  function cardBackSvgHTML(mini) {
    var vb = mini ? "0 0 58 80" : "0 0 76 104";
    var w = mini ? 54 : 70;
    var h = mini ? 76 : 98;
    var pid = "pb-" + Math.random().toString(36).slice(2, 11);
    return (
      '<svg class="play-card-svg play-card-svg--back" viewBox="' +
      vb +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" shape-rendering="geometricPrecision" overflow="hidden">' +
      '<defs><pattern id="' +
      pid +
      '" width="8" height="8" patternUnits="userSpaceOnUse">' +
      '<rect width="8" height="8" fill="#334b66"/>' +
      '<path d="M0 8 L8 0 M-2 2 L2 -2 M6 10 L10 6" stroke="#1a2538" stroke-width="1.05" fill="none"/></pattern></defs>' +
      '<rect x="2" y="2" width="' +
      w +
      '" height="' +
      h +
      '" rx="5" fill="url(#' +
      pid +
      ')" stroke="#c9a227" stroke-width="1.5"/>' +
      '<rect x="6" y="6" width="' +
      (w - 8) +
      '" height="' +
      (h - 8) +
      '" rx="3" fill="none" stroke="rgba(201,162,39,0.45)" stroke-width="1"/>' +
      "</svg>"
    );
  }

  function setDragCardIds(ev, ids) {
    var json = JSON.stringify(ids);
    try {
      ev.dataTransfer.setData("application/x-card-ids", json);
    } catch (_) {}
    ev.dataTransfer.setData("text/plain", json);
  }

  function getDragCardIds(ev) {
    var raw = "";
    try {
      raw = ev.dataTransfer.getData("application/x-card-ids");
    } catch (_) {}
    if (!raw) raw = ev.dataTransfer.getData("text/plain");
    if (!raw) return null;
    try {
      var ids = JSON.parse(raw);
      return Array.isArray(ids) ? ids : null;
    } catch (_) {
      return null;
    }
  }

  function csrf() {
    var m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function api(method, url, body) {
    var opts = { method: method, credentials: "same-origin", headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["X-CSRFToken"] = csrf();
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (t) {
        var data;
        try {
          data = t ? JSON.parse(t) : null;
        } catch (_) {
          data = t;
        }
        if (!r.ok) throw new Error((data && data.detail) || r.statusText || String(r.status));
        return data;
      });
    });
  }

  function setErr(msg) {
    var el = document.getElementById("err");
    if (el) el.textContent = msg || "";
  }

  function uidStr() {
    return profile && profile.id != null ? String(profile.id) : "";
  }

  function pruneSelection(hand) {
    if (!hand || !hand.length) {
      selected.clear();
      return;
    }
    var ok = new Set(hand.map(function (c) { return c.id; }));
    selected.forEach(function (id) {
      if (!ok.has(id)) selected.delete(id);
    });
  }

  function attackPayloadFromDrag(cardId) {
    if (selected.has(cardId) && selected.size > 0) {
      return Array.from(selected);
    }
    return [cardId];
  }

  function otherPlayers(uid) {
    return state.players
      .slice()
      .sort(function (a, b) {
        return a.seat_position - b.seat_position;
      })
      .filter(function (p) {
        return String(p.user_id) !== uid;
      });
  }

  function playerRoleShort(uidStr, rt) {
    if (!rt || state.status !== "in_progress") return "";
    if (String(rt.attacker_id) === uidStr) return "attacking";
    if (String(rt.defender_id) === uidStr) return "defending";
    return "in play";
  }

  function renderOpponents(uid, rt) {
    var el = document.getElementById("opponents");
    if (!el) return;
    el.innerHTML = "";
    var others = otherPlayers(uid);
    if (!others.length) return;
    others.forEach(function (p) {
      var role = playerRoleShort(String(p.user_id), rt);
      var div = document.createElement("div");
      div.className = "play-opponent";
      var n = p.cards_remaining != null ? p.cards_remaining : 0;
      var backs = "";
      var show = Math.min(6, Math.max(1, n));
      for (var i = 0; i < show; i++) {
        backs +=
          '<span class="play-opponent__back" style="--i:' + i + '">' + cardBackSvgHTML(true) + "</span>";
      }
      div.innerHTML =
        '<div class="play-opponent__info">' +
        '<span class="play-opponent__name">' +
        escapeHtml(p.username) +
        "</span>" +
        '<span class="play-opponent__meta">' +
        n +
        " cards · " +
        role +
        "</span></div>" +
        '<div class="play-opponent__backs">' +
        backs +
        "</div>";
      el.appendChild(div);
    });
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  /** Stable pseudo-random peek offsets per table row so stacks stay readable when overlapping. */
  function stackPeekFromRowId(rowId) {
    var s = String(rowId);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    var u = function (x) {
      return ((x >>> 0) % 10001) / 10000;
    };
    var a = h >>> 0;
    var b = Math.imul(h, 70460287) >>> 0;
    var c = Math.imul(h, 134775813) >>> 0;
    var dxD = -(6 + u(a) * 10);
    var dyD = 5 + u(b) * 12;
    var dxA = 5 + u(c) * 9;
    var dyA = -(6 + u(a + c) * 10);
    var rotAtk = -5 + u(b) * 7;
    var rotDef = -2 + u(a ^ c) * 7;
    return {
      dxD: dxD.toFixed(2) + "px",
      dyD: dyD.toFixed(2) + "px",
      rotD: rotAtk.toFixed(2) + "deg",
      dxA: dxA.toFixed(2) + "px",
      dyA: dyA.toFixed(2) + "px",
      rotA: rotDef.toFixed(2) + "deg",
    };
  }

  function renderDeckTrumpCorner(tcTrump, deckN) {
    var el = document.getElementById("deck-trump-corner");
    if (!el) return;
    var parts = ['<div class="play-deck-trump-pile">'];
    if (tcTrump) {
      parts.push(
        '<div class="play-trump-card play-trump-card--under-deck" title="Trump: ' +
          suitNameEn(tcTrump.suit) +
          '">' +
          cardSvgOuterHTML(tcTrump, {}) +
          "</div>"
      );
    }
    if (deckN > 0) {
      parts.push('<div class="play-deck-stack" title="Cards in deck">');
      var layers = Math.min(4, Math.max(1, Math.ceil(deckN / 10)));
      for (var j = 0; j < layers; j++) {
        parts.push(
          '<span class="play-deck-stack__layer" style="--layer:' +
            j +
            '">' +
            cardBackSvgHTML(false) +
            "</span>"
        );
      }
      parts.push('<span class="play-deck-stack__count">' + deckN + "</span></div>");
    } else {
      parts.push('<div class="play-deck-stack play-deck-stack--empty">Deck empty</div>');
    }
    parts.push("</div>");
    el.innerHTML = parts.join("");
  }

  function renderStatusbar(uid, me, rt) {
    var el = document.getElementById("play-statusbar");
    if (!el) return;
    if (state.status === "finished") {
      var loser = "";
      if (state.loser_id) {
        var lp = state.players.find(function (p) {
          return String(p.user_id) === String(state.loser_id);
        });
        loser = lp ? lp.username : state.loser_id;
      }
      el.textContent =
        "Game over" + (loser ? ". Fool: " + loser : "") + ".";
      return;
    }
    var partsArr = ["Podkidnoy Durak"];
    partsArr.push("Phase: " + phaseEn(rt && rt.phase));
    partsArr.push("Deck: " + (state.deck_remaining != null ? state.deck_remaining : 0));
    if (state.trump_card) {
      partsArr.push("Trump: " + suitNameEn(state.trump_card.suit));
    }
    partsArr.push("Table rows: " + (state.table ? state.table.length : 0));
    if (me) {
      partsArr.push("You: " + me.username);
    }
    el.textContent = partsArr.join(" · ");
  }

  function renderMyRole(uid, rt) {
    var el = document.getElementById("play-my-role");
    if (!el) return;
    if (state.status === "finished") {
      if (state.loser_id && String(state.loser_id) === uid) {
        el.textContent = "You lost (fool).";
      } else {
        el.textContent = "Round finished.";
      }
      return;
    }
    if (!rt) {
      el.textContent = "";
      return;
    }
    if (String(rt.attacker_id) === uid) {
      el.textContent = "Your role: attacker.";
    } else if (String(rt.defender_id) === uid) {
      el.textContent = "Your role: defender.";
    } else {
      el.textContent = "Your role: throw-in.";
    }
  }

  function hintText(uid, me, rt) {
    if (state.status === "finished") return "";
    if (!rt) return "";
    var isAtt = rt.attacker_id != null && String(rt.attacker_id) === uid;
    var isDef = rt.defender_id != null && String(rt.defender_id) === uid;
    var tbl = state.table || [];
    var allDef = tbl.length > 0 && tbl.every(function (r) { return r.defense; });
    var wave = rt.phase === "build" || rt.phase === "defend";

    if (rt.phase === "between" && isAtt) {
      return "Drag cards onto the felt to open the attack.";
    }
    if (wave && isDef) {
      return "Beat uncovered attacks by dragging onto them, or use Take cards.";
    }
    if (wave && isAtt && allDef) {
      return "Add more cards if allowed, or press Discard pile when done.";
    }
    if (wave && !isDef) {
      return "Drag a rank already on the table onto the felt to throw in.";
    }
    if (wave && isAtt) {
      return "Keep attacking; the defender may beat cards at any time.";
    }
    return "Waiting…";
  }

  function wireActionButtons() {
    var take = document.getElementById("btn-take");
    var bito = document.getElementById("btn-bito");
    function once(btn, handler) {
      if (!btn || btn.dataset.wired === "1") return;
      btn.dataset.wired = "1";
      btn.addEventListener("click", handler);
    }
    once(take, function () {
      setErr("");
      api("POST", BASE + "take/", {})
        .then(function (s) {
          state = s;
          selected.clear();
          render();
        })
        .catch(function (e) {
          setErr(e.message);
        });
    });
    once(bito, function () {
      setErr("");
      api("POST", BASE + "bito/", {})
        .then(function (s) {
          state = s;
          selected.clear();
          render();
        })
        .catch(function (e) {
          setErr(e.message);
        });
    });
  }

  function updateActionButtons(uid, rt) {
    rt = rt || {};
    var isAtt = rt.attacker_id != null && String(rt.attacker_id) === uid;
    var isDef = rt.defender_id != null && String(rt.defender_id) === uid;
    var takeBtn = document.getElementById("btn-take");
    var bitoBtn = document.getElementById("btn-bito");
    var inProg = state.status === "in_progress";
    var wave = rt.phase === "build" || rt.phase === "defend";
    var tbl = state.table || [];
    var show = inProg && wave && tbl.length > 0;
    var allDefended =
      tbl.length > 0 && tbl.every(function (r) { return r.defense; });

    if (takeBtn) {
      takeBtn.hidden = !show;
      if (show) {
        takeBtn.disabled = !isDef;
        takeBtn.setAttribute("aria-disabled", takeBtn.disabled ? "true" : "false");
      }
    }
    if (bitoBtn) {
      bitoBtn.hidden = !show;
      if (show) {
        bitoBtn.disabled = !(isAtt && allDefended);
        bitoBtn.setAttribute("aria-disabled", bitoBtn.disabled ? "true" : "false");
      }
    }
  }

  function render() {
    if (!state) return;
    var uid = uidStr();
    var me = uid && state.players.find(function (p) { return String(p.user_id) === uid; });
    var rt = state.runtime || {};
    var tcTrump = state.trump_card;
    var trumpSuit = tcTrump ? tcTrump.suit : null;

    var back = document.getElementById("back-lobby");
    if (back) back.href = "/game/lobbies/" + state.lobby_id + "/";

    renderStatusbar(uid, me, rt);
    renderMyRole(uid, rt);
    renderOpponents(uid, rt);
    renderDeckTrumpCorner(tcTrump, state.deck_remaining || 0);

    pruneSelection(me && me.hand);
    var handEl = document.getElementById("hand");
    if (handEl) {
      handEl.innerHTML = "";
      if (me && me.hand) {
        var inner = document.createElement("div");
        inner.className = "play-hand-fan__inner";
        var n = me.hand.length;
        var mid = (n - 1) / 2;
        var maxDist = Math.max(mid, n - 1 - mid) || 1;
        me.hand.forEach(function (c, idx) {
          var wrap = document.createElement("div");
          wrap.className = "play-card play-card--hand";
          wrap.dataset.cid = c.id;
          if (trumpSuit && c.suit === trumpSuit) wrap.classList.add("play-card--trump");
          if (selected.has(c.id)) wrap.classList.add("is-selected");
          wrap.setAttribute("draggable", "true");
          wrap.setAttribute("aria-label", c.rank + " " + c.suit);
          wrap.innerHTML = cardSvgOuterHTML(c, {});
          var dist = Math.abs(idx - mid);
          var norm = dist / maxDist;
          var rot = (idx - mid) * 7.25;
          var y = norm * norm * 16 + norm * 3;
          var x = (idx - mid) * 0.85;
          wrap.style.setProperty("--fan-rot", rot + "deg");
          wrap.style.setProperty("--fan-y", y + "px");
          wrap.style.setProperty("--fan-x", x + "px");
          wrap.style.zIndex = String(30 - Math.abs(idx - mid));
          wrap.addEventListener("click", function (ev) {
            ev.preventDefault();
            if (selected.has(c.id)) selected.delete(c.id);
            else selected.add(c.id);
            wrap.classList.toggle("is-selected", selected.has(c.id));
          });
          wrap.addEventListener("dragstart", function (ev) {
            var ids = attackPayloadFromDrag(c.id);
            setDragCardIds(ev, ids);
            wrap.classList.add("is-dragging");
          });
          wrap.addEventListener("dragend", function () {
            wrap.classList.remove("is-dragging");
          });
          inner.appendChild(wrap);
        });
        handEl.appendChild(inner);
      }
    }

    var tbl = document.getElementById("table-rows");
    if (tbl) {
      tbl.innerHTML = "";
      state.table.forEach(function (row) {
        var d = document.createElement("div");
        d.className = "play-table-pair";
        d.dataset.tableCardId = row.id;
        if (!row.defense) d.classList.add("play-table-pair--defend-target");

        var stack = document.createElement("div");
        stack.className = "play-table-stack";

        var peek = stackPeekFromRowId(row.id);

        var def = document.createElement("div");
        def.className =
          "play-card play-card--table play-card--stack-def" +
          (row.defense ? "" : " play-card--placeholder");
        def.innerHTML = row.defense ? cardSvgOuterHTML(row.defense, {}) : "";
        def.style.setProperty("--peek-def-x", peek.dxA);
        def.style.setProperty("--peek-def-y", peek.dyA);
        def.style.setProperty("--peek-def-rot", peek.rotA);

        var atk = document.createElement("div");
        atk.className = "play-card play-card--table play-card--stack-atk";
        atk.innerHTML = cardSvgOuterHTML(row.attack, {});
        atk.style.setProperty("--peek-atk-x", peek.dxD);
        atk.style.setProperty("--peek-atk-y", peek.dyD);
        atk.style.setProperty("--peek-atk-rot", peek.rotD);

        stack.appendChild(atk);
        stack.appendChild(def);
        d.appendChild(stack);

        tbl.appendChild(d);
      });
    }

    wireDropTargets(uid, me, rt);
    updateActionButtons(uid, rt);

    var hint = document.getElementById("play-hint");
    if (hint) hint.textContent = hintText(uid, me, rt);
  }

  function allowDrop(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "copy";
  }

  function wireDropTargets(uid, me, rt) {
    rt = rt || {};
    var isAtt = rt.attacker_id != null && String(rt.attacker_id) === uid;
    var isDef = rt.defender_id != null && String(rt.defender_id) === uid;
    var wave = rt.phase === "build" || rt.phase === "defend";

    var mat = document.getElementById("table-mat");
    if (mat) {
      mat.ondragover = allowDrop;
      mat.ondrop = null;
      var allowMat =
        state.status === "in_progress" &&
        (rt.phase === "between" || wave) &&
        (rt.phase === "between" ? isAtt : !isDef);
      if (allowMat) {
        mat.ondrop = function (ev) {
          ev.preventDefault();
          var ids = getDragCardIds(ev);
          if (!ids || !ids.length) return;
          setErr("");
          api("POST", BASE + "attack/", { card_ids: ids })
            .then(function (s) {
              state = s;
              selected.clear();
              render();
            })
            .catch(function (e) {
              setErr(e.message);
            });
        };
      }
    }

    document.querySelectorAll(".play-table-pair--defend-target").forEach(function (rowEl) {
      rowEl.ondragover = allowDrop;
      rowEl.ondrop = null;
      if (state.status === "in_progress" && wave && isDef) {
        rowEl.ondrop = function (ev) {
          ev.preventDefault();
          var ids = getDragCardIds(ev);
          if (!ids || !ids.length) return;
          var tid = rowEl.dataset.tableCardId;
          if (!tid) return;
          setErr("");
          api("POST", BASE + "defend/", { table_card_id: tid, card_id: ids[0] })
            .then(function (s) {
              state = s;
              selected.clear();
              render();
            })
            .catch(function (e) {
              setErr(e.message);
            });
        };
      }
    });
  }

  function refresh() {
    return api("GET", BASE).then(function (s) {
      state = s;
      render();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireActionButtons();
    var wsProto = location.protocol === "https:" ? "wss:" : "ws:";
    var ws = new WebSocket(wsProto + "//" + location.host + "/ws/games/" + gameId + "/");
    ws.onmessage = function () {
      refresh().catch(function (e) {
        setErr(e.message);
      });
    };

    api("GET", "/api/accounts/auth/profile/")
      .then(function (p) {
        profile = p;
        return refresh();
      })
      .catch(function (e) {
        setErr(e.message);
      });
  });
})();
