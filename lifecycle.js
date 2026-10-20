// Every page owns its listeners, observers, timers, and animation frames.
// Dispose them before Barba replaces that page's DOM.
window.createPageScope = () => {
  const cleanups = [];
  return {
    on(target, type, listener, options) {
      if (!target?.addEventListener) return;
      target.addEventListener(type, listener, options);
      cleanups.push(() => target.removeEventListener(type, listener, options));
    },
    observe(observer) {
      cleanups.push(() => observer.disconnect());
      return observer;
    },
    timeout(callback, delay) {
      const timer = setTimeout(callback, delay);
      cleanups.push(() => clearTimeout(timer));
    },
    cleanup(callback) { cleanups.push(callback); },
    dispose() { cleanups.splice(0).reverse().forEach(callback => callback()); },
  };
};
