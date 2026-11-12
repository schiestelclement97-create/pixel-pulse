/* Pixel Pulse : publicités des jeux (Google AdSense, H5 Games Ads / Ad Placement API)
   - PPAds.reward(nom, cb) : pub récompensée. cb(true) = donner le bonus.
     Si aucune pub n'est disponible (compte pas encore validé, bloqueur de pub…), le bonus est offert quand même.
   - PPAds.inter(nom) : pub plein écran à un moment de pause (Google limite la fréquence).
   Test : ajouter ?adtest=on à l'adresse du jeu. */
(function () {
  if (window.PPAds) return;
  var CLIENT = 'ca-pub-8151486169178097';
  var test = /[?&]adtest=on/.test(location.search);
  var s = document.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
  s.setAttribute('data-ad-client', CLIENT);
  s.setAttribute('data-ad-frequency-hint', '90s');
  if (test) s.setAttribute('data-adbreak-test', 'on');
  (document.head || document.documentElement).appendChild(s);
  window.adsbygoogle = window.adsbygoogle || [];
  var push = function (o) { window.adsbygoogle.push(o); };
  window.adBreak = push; window.adConfig = push;
  try { adConfig({ preloadAdBreaks: 'on', sound: 'on' }); } catch (e) {}
  function ev(n) { try { document.dispatchEvent(new Event(n)); } catch (e) {} }
  var busy = false;
  window.PPAds = {
    reward: function (name, cb) {
      if (busy) return; busy = true;
      var offered = false, done = false;
      function fin(ok, why) { if (done) return; done = true; busy = false; clearTimeout(t); try { cb(ok, why); } catch (e) {} }
      var t = setTimeout(function () { if (!offered) fin(true, 'free'); }, 3000);
      try {
        adBreak({ type: 'reward', name: name,
          beforeAd: function () { ev('pp-ad-start'); }, afterAd: function () { ev('pp-ad-end'); },
          beforeReward: function (show) { if (done) return; offered = true; clearTimeout(t); show(); },
          adDismissed: function () { fin(false, 'dismissed'); },
          adViewed: function () { fin(true, 'viewed'); },
          adBreakDone: function (i) { var st = i && i.breakStatus;
            if (st === 'dismissed') fin(false, 'dismissed'); else if (st === 'viewed') fin(true, 'viewed'); else if (!offered) fin(true, 'free'); }
        });
      } catch (e) { fin(true, 'free'); }
    },
    inter: function (name) {
      try { adBreak({ type: 'next', name: name, beforeAd: function () { ev('pp-ad-start'); }, afterAd: function () { ev('pp-ad-end'); } }); } catch (e) {}
    }
  };
})();
