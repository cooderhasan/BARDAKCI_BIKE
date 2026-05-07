import { getTrendyolQuestions } from "../actions";
import { TrendyolQuestionsList } from "@/components/admin/trendyol-questions-list";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Info } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshButton } from "@/components/admin/refresh-button";

export const dynamic = "force-dynamic";

export default async function TrendyolQuestionsPage() {
    // Default to fetch waiting for answer questions
    const result = await getTrendyolQuestions({ status: "WAITING_FOR_ANSWER", size: 50 });

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/integrations/trendyol">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Trendyol Soruları</h1>
                        <p className="text-sm text-muted-foreground">Müşterilerden gelen ürün sorularını yönetin</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <RefreshButton />
                </div>
            </div>

            <Alert className="bg-orange-50 border-orange-200 text-orange-900">
                <Info className="h-4 w-4 text-orange-600" />
                <AlertTitle className="font-semibold">Biliyor musunuz?</AlertTitle>
                <AlertDescription className="text-orange-800/80">
                    Trendyol politikaları gereği verdiğiniz cevaplar moderasyon ekibi tarafından kontrol edilir. Cevabınızda telefon numarası, adres veya harici link paylaşmamaya dikkat edin.
                </AlertDescription>
            </Alert>

            {!result.success ? (
                <div className="bg-red-50 border border-red-200 text-red-700 p-8 rounded-xl text-center">
                    <h3 className="text-lg font-semibold mb-2">Hata Oluştu</h3>
                    <p>{result.message}</p>
                    <Link href="/admin/integrations/trendyol" className="inline-block mt-4">
                        <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-100">Ayarları Kontrol Et</Button>
                    </Link>
                </div>
            ) : (
                <TrendyolQuestionsList initialQuestions={result.data} />
            )}
        </div>
    );
}
