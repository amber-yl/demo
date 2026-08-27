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
    additionalData?: string | ((content: string) => string);
    [key: string]: unknown;
  }
  interface WithLessConfig extends NextConfig {
    lessLoaderOptions?: LessLoaderOptions;
  }
  function withLess(config: WithLessConfig): NextConfig;
  export = withLess;
  export default withLess;
}
