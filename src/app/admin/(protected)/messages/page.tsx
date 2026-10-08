import { MessagesTable } from "@/components/admin/messages-table";
import { getContactMessages } from "@/app/actions/contact";

export default async function MessagesPage() {
    const messages = await getContactMessages();

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Gelen Mesajlar</h1>
            </div>
            <MessagesTable messages={messages} />
        </div>
    );
}
