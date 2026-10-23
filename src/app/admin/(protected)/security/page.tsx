import { getBackupCodeCount } from "./actions";
import { BackupCodesPanel } from "./backup-codes-panel";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
    const remaining = await getBackupCodeCount();
    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Güvenlik</h2>
                <p className="text-gray-500 dark:text-gray-400">İki adımlı doğrulama (Google Authenticator) ve yedek kodlar</p>
            </div>
            <BackupCodesPanel remaining={remaining} />
        </div>
    );
}
