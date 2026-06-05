// 2026-12 Indic font preload — loads the Noto Sans family for the saved UI
// language synchronously, BEFORE React hydrates, so Bengali / Tamil / Telugu
// / Kannada / Malayalam / Odia / Gujarati / Punjabi / Marathi / Hindi
// teachers landing on the app never see tofu boxes (▢▢▢).
//
// Without this, ensureIndicFontLoaded() in language-context.tsx fires only
// after React mount (~200–500ms), so the initial paint shows the body font
// (Inter) which has no glyphs for any Indic script.
(function () {
    try {
        var lang = localStorage.getItem('sahayakai-lang');
        var map = {
            Hindi:     'Noto+Sans+Devanagari',
            Marathi:   'Noto+Sans+Devanagari',
            Bengali:   'Noto+Sans+Bengali',
            Tamil:     'Noto+Sans+Tamil',
            Telugu:    'Noto+Sans+Telugu',
            Kannada:   'Noto+Sans+Kannada',
            Malayalam: 'Noto+Sans+Malayalam',
            Gujarati:  'Noto+Sans+Gujarati',
            Punjabi:   'Noto+Sans+Gurmukhi',
            Odia:      'Noto+Sans+Oriya'
        };
        var fam = lang && map[lang];
        if (fam) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=' + fam +
                ':wght@400;500;600;700&display=swap';
            link.setAttribute('data-indic-font', lang);
            document.head.appendChild(link);
        }
    } catch (e) {
        // localStorage may be unavailable in restricted webviews — silently no-op.
    }
})();
