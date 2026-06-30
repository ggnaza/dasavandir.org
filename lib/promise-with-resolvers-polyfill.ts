// Polyfill for Promise.withResolvers (ES2024).
// pdfjs-dist v4 / react-pdf v9 call this at runtime; it's missing on Safari
// < 17.4 and other older browsers, where the unpolyfilled call throws and
// takes down the whole lesson page. Defining it only when absent leaves
// modern browsers untouched. Import this BEFORE react-pdf.
if (typeof (Promise as any).withResolvers !== "function") {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export {};
