export {} 

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            readonly BOT_TOKEN: string;
            readonly APPLICATION_ID: string;
            readonly OUTPUT_CHANNEL_ID: string;
            readonly ROLE_AUSTRIA: string;
            readonly ROLE_ENGLAND: string;
            readonly ROLE_FRANCE: string;
            readonly ROLE_GERMANY: string;
            readonly ROLE_ITALY: string;
            readonly ROLE_RUSSIA: string;
            readonly ROLE_TURKEY: string;
            readonly VC_MAIN: string;
            readonly VC_ENGLAND: string;
            readonly VC_FRANCE: string;
            readonly VC_GERMANY: string;
            readonly VC_AUSTRIA: string;
            readonly VC_ITALY: string;
            readonly VC_RUSSIA: string;
            readonly VC_TURKEY: string;
            readonly VC_JAIL: string;
        }
    }
}
