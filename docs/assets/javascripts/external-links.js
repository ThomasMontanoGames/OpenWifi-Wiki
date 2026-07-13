// Open external links in a new tab. Internal wiki links are left alone so
// Material's navigation.instant keeps handling them as fast in-page swaps.
// `document$` fires on every page load, including instant navigation, so the
// rewrite is reapplied after each in-page transition.
document$.subscribe(function () {
  const here = document.location.hostname;
  document.querySelectorAll('a[href]').forEach(function (link) {
    if (link.hostname && link.hostname !== here) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });
});
