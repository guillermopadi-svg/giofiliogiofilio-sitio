/* Clean OAuth callbacks before the SDK can add a fragment to browser history. */
(function () {
  'use strict';
  var views = ['inicio','propiedades','contactos','tareas','solicitudes','estimador','documentos','equipo','configuracion'];
  var pending = null;
  var authError = false;
  function cleanCallback(capture) {
    var params = new URLSearchParams(location.hash.slice(1));
    if (!['access_token','refresh_token','provider_token','error','error_description'].some(function (key) { return params.has(key); })) return;
    if (capture) {
      authError = params.has('error') || !params.get('access_token') || !params.get('refresh_token');
      if (!authError) pending = {access_token:params.get('access_token'),refresh_token:params.get('refresh_token')};
    }
    history.replaceState(null, '', location.pathname + location.search + '#inicio');
  }
  cleanCallback(true);
  window.GF_ADMIN_NAV = {
    hasAuthError: function () { return authError; },
    session: function (auth) {
      var tokens = pending;
      pending = null;
      if (!tokens) return auth.getSession();
      return auth.setSession(tokens).finally(function () { tokens = null; });
    },
    current: function () {
      var name = location.hash.slice(1);
      return views.indexOf(name) >= 0 ? name : 'inicio';
    },
    write: function (view, replace) {
      if (views.indexOf(view) < 0) return;
      cleanCallback(false);
      var url = location.pathname + location.search + '#' + view;
      if (location.hash === '#' + view && !replace) return;
      history[replace ? 'replaceState' : 'pushState'](null, '', url);
    },
    listen: function (render) {
      function restore() { cleanCallback(false); render(window.GF_ADMIN_NAV.current()); }
      window.addEventListener('popstate', restore);
      window.addEventListener('hashchange', restore);
      window.addEventListener('pageshow', function (event) { if (event.persisted) restore(); });
    }
  };
})();
