declare module "*.module.less" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.less" {
  const content: string;
  export default content;
}

declare module "next-with-less" {
  type NextConfig = import("next").NextConfig;
  interface LessLoaderOptions {
    lessOptions?: Record<string, unknown>;
    [key: string]: unknown;
  }
  interface WithLessOptions {
    lessLoaderOptions?: LessLoaderOptions;
    [key: string]: unknown;
  }
  function createWithLess(
    options?: WithLessOptions,
  ): (config?: NextConfig) => NextConfig;
  export = createWithLess;
  export default createWithLess;
}
