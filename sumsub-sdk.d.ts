declare module '@sumsub/react-native-mobilesdk-module' {
  interface SumsubHandlers {
    onStatusChanged?: (status: any) => void;
    onEvent?: (event: any) => void;
    onLog?: (event: any) => void;
  }

  interface SumsubResult {
    success: boolean;
    status?: string;
    errorType?: string;
    errorMsg?: string;
  }

  interface SumsubBuilder {
    withHandlers(handlers: SumsubHandlers): SumsubBuilder;
    withDebug(debug: boolean): SumsubBuilder;
    withLocale(locale: string): SumsubBuilder;
    build(): SumsubSDKInstance;
  }

  interface SumsubSDKInstance {
    launch(): Promise<SumsubResult>;
  }

  interface SumsubSdk {
    init(accessToken: string, expirationHandler?: () => Promise<string>): SumsubBuilder;
  }

  const SumsubSdk: SumsubSdk;
  export default SumsubSdk;
}

