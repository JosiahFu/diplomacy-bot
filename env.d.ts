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

        }
    }
}
