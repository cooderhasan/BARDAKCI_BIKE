import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { redirect } from "next/navigation";
import { AdminSidebarModern } from "@/components/admin/admin-sidebar-modern";
import { AdminHeader } from "@/components/admin/admin-header";
import { UpdateBanner } from "@/components/admin/update-banner";
import { AiAnnouncementBanner } from "@/components/admin/ai-announcement-banner";
import { AbandonedCartBanner } from "@/components/admin/abandoned-cart-banner";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    console.log("LAYOUT_DEBUG: Session User:", session?.user?.email, "Role:", session?.user?.role);

    // Auth check is handled by Middleware. Redundant check here causes loops if auth() behaves differently than middleware.
    // if (!session?.user) {
    //    redirect("/admin/login");
    // }

    if (session?.user && session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
        redirect("/");
    }

    const settings = await getSiteSettings();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 print:bg-white flex">
            {/* New Modern Sidebar */}
            <AdminSidebarModern settings={settings} />

            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:pl-72 print:pl-0">
                <AdminHeader user={session?.user as any} />
                <AiAnnouncementBanner />
                <AbandonedCartBanner />
                <UpdateBanner />
                <main className="py-6 px-4 sm:px-6 lg:px-8 print:p-0 print:m-0 w-full">
                    {children}
                </main>
            </div>
        </div>
    );
}
