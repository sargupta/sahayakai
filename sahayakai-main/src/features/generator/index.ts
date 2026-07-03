// Generator feature spine — shared state machine + page shell for the
// ~15 generator tools. See docs/design/proposals/05-frontend-arch.md.

export { useGenerator } from "./hooks/use-generator";
export type { UseGeneratorConfig, UseGeneratorReturn } from "./hooks/use-generator";

export { GeneratorPage, GeneratorSubmitBar } from "./components/generator-page";
export type { GeneratorPageProps, GeneratorLimitState } from "./components/generator-page";

export { GeneratorProgress } from "./components/generator-progress";
export type { GeneratorProgressProps } from "./components/generator-progress";

export { MalformedResponseError } from "./types";
export type { GeneratorStatus, GeneratorError, GeneratorErrorCode } from "./types";

export { GENERATOR_SHELL_COPY } from "./i18n";
