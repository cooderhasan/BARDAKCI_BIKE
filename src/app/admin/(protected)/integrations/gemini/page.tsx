"use client";

import { useState, useEffect } from "react";
import { getGeminiConfig, saveGeminiConfig } from "./actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Save, ExternalLink, Zap, Globe, Edit3 } from "lucide-react";

const RECOMMENDED_MODELS = [
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (Hızlı & Ekonomik)", category: "En İyi Seçenek" },
    { value: "openai/gpt-4o", label: "GPT-4o (En Zeki & Kapsamlı)", category: "En İyi Seçenek" },
    { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (Üst Düzey Yazım)", category: "Premium" },
    { value: "qwen/qwen-plus", label: "Qwen Plus (Dengeli & Kaliteli)", category: "Qwen" },
    { value: "qwen/qwen-turbo", label: "Qwen Turbo (Çok Hızlı)", category: "Qwen" },
    { value: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B (Kapsamlı)", category: "Teknik" },
    { value: "google/gemini-pro-1.5", label: "Gemini 1.5 Pro (Google Zekası)", category: "Google" },
    { value: "meta-llama/llama-3.2-11b-vision-instruct", label: "Llama 3.2 11B (Yeni)", category: "Meta" },
];

export default function GeminiIntegrationPage() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [provider, setProvider] = useState<string>("GEMINI");
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [isCustomModel, setIsCustomModel] = useState(false);

    useEffect(() => {
        getGeminiConfig().then(res => {
            if (res.success && res.data) {
                setConfig(res.data);
                setProvider(res.data.provider || "GEMINI");
                const model = res.data.openRouterModel || "qwen/qwen3.6-plus:free";
                setSelectedModel(model);
                
                // Eğer mevcut model önerilenler listesinde yoksa manuel girişi aktif et
                const isRecommended = RECOMMENDED_MODELS.some(m => m.value === model);
                setIsCustomModel(!isRecommended);
            }
            setLoading(false);
        });
    }, []);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        
        const formData = new FormData(e.currentTarget);
        
        // HATA FIX: openRouterModel degerinin her zaman doğru teknik ID olmasını sagliyoruz
        formData.set("openRouterModel", selectedModel);

        const res = await saveGeminiConfig(formData);
        if (res.success) {
            toast.success("Ayarlar başarıyla kaydedildi.");
        } else {
            toast.error(res.error || "Bir hata oluştu.");
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
                    <Brain className="w-7 h-7" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Yapay Zeka (AI) Entegrasyonu</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ürün açıklamalarınızı otomatik oluşturmak için AI sağlayıcınızı yönetin.</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <Card className="border-indigo-100 dark:border-indigo-900/30 overflow-hidden shadow-sm">
                    <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/10 border-b">
                        <CardTitle className="text-lg">Sağlayıcı Ayarları</CardTitle>
                        <CardDescription>Hangi yapay zeka servisini kullanmak istediğinizi seçin.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        
                        {/* Status Switch */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold">Entegrasyon Durumu</Label>
                                <p className="text-xs text-gray-500">AI servislerini tüm sitede aktif veya pasif hale getirin.</p>
                            </div>
                            <Switch 
                                name="isActive" 
                                defaultChecked={config?.isActive} 
                            />
                        </div>

                        {/* Provider Selection */}
                        <div className="space-y-4">
                            <Label className="text-sm font-bold">Yapay Zeka Sağlayıcısı</Label>
                                    <RadioGroup 
                                        name="provider" 
                                        value={provider} 
                                        onValueChange={setProvider}
                                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                    >
                                        <div>
                                            <RadioGroupItem value="GEMINI" id="gemini" className="peer sr-only" />
                                            <Label
                                                htmlFor="gemini"
                                                className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-indigo-600 peer-data-[state=checked]:bg-indigo-50/50 dark:peer-data-[state=checked]:bg-indigo-900/20 peer-data-[state=checked]:text-indigo-600 cursor-pointer transition-all"
                                            >
                                                <Globe className="mb-3 h-6 w-6" />
                                                <div className="text-center">
                                                    <div className="font-bold">Google Gemini</div>
                                                    <div className="text-[10px] text-muted-foreground mt-1">Hızlı ve Geniş Ücretsiz Katman</div>
                                                </div>
                                            </Label>
                                        </div>

                                        <div>
                                            <RadioGroupItem value="OPENROUTER" id="openrouter" className="peer sr-only" />
                                            <Label
                                                htmlFor="openrouter"
                                                className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50/50 dark:peer-data-[state=checked]:bg-purple-900/20 peer-data-[state=checked]:text-purple-600 cursor-pointer transition-all"
                                            >
                                                <Zap className="mb-3 h-6 w-6" />
                                                <div className="text-center">
                                                    <div className="font-bold">OpenRouter</div>
                                                    <div className="text-[10px] text-muted-foreground mt-1">Llama 3, Mistral, Qwen vb. Çoklu Model</div>
                                                </div>
                                            </Label>
                                        </div>
                            </RadioGroup>
                        </div>

                        {/* API Key Fields based on provider */}
                        <div className="space-y-6 pt-4 border-t">
                            {provider === "GEMINI" ? (
                                <div className="space-y-4 animate-in slide-in-from-left duration-300">
                                    <div className="space-y-2">
                                        <Label htmlFor="apiKey" className="text-sm font-medium">Gemini API Key *</Label>
                                        <Input
                                            id="apiKey"
                                            name="apiKey"
                                            type="password"
                                            defaultValue={config?.apiKey || ""}
                                            placeholder="AIzaSy..."
                                            className="font-mono"
                                        />
                                        <p className="text-[11px] text-gray-500">
                                            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                                                Google AI Studio'dan anahtar alın <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in slide-in-from-right duration-300">
                                    <div className="space-y-2">
                                        <Label htmlFor="openRouterApiKey" className="text-sm font-medium">OpenRouter API Key *</Label>
                                        <Input
                                            id="openRouterApiKey"
                                            name="openRouterApiKey"
                                            type="password"
                                            defaultValue={config?.openRouterApiKey || ""}
                                            placeholder="sk-or-v1-..."
                                            className="font-mono bg-purple-50/10 border-purple-100"
                                        />
                                        <p className="text-[11px] text-gray-500">
                                            <a href="https://openrouter.ai/keys" target="_blank" className="text-purple-600 hover:underline inline-flex items-center gap-1">
                                                OpenRouter'dan anahtar alın <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">Kullanılacak Model</Label>
                                        
                                        {/* GIZLI INPUT: Verinin DB'ye doğru teknik kodla gitmesini garanti eder */}
                                        <input type="hidden" name="openRouterModel" value={selectedModel} />

                                        <Select 
                                            value={isCustomModel ? "custom" : selectedModel} 
                                            onValueChange={(val) => {
                                                if (val === "custom") {
                                                    setIsCustomModel(true);
                                                } else {
                                                    setIsCustomModel(false);
                                                    setSelectedModel(val);
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="bg-purple-50/10 border-purple-100 w-full focus:ring-purple-600">
                                                <SelectValue placeholder="Model seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {RECOMMENDED_MODELS.map((model) => (
                                                    <SelectItem key={model.value} value={model.value}>
                                                        <div className="flex items-center justify-between w-full gap-4">
                                                            <span>{model.label}</span>
                                                            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500">{model.category}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="custom" className="text-purple-600 font-semibold">
                                                    <div className="flex items-center gap-2">
                                                        <Edit3 className="w-3 h-3" />
                                                        Özel (Manuel Giriş)
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {isCustomModel && (
                                            <div className="pt-2 animate-in slide-in-from-top-2 duration-200">
                                                <Input
                                                    id="customModelInput"
                                                    type="text"
                                                    value={selectedModel}
                                                    onChange={(e) => setSelectedModel(e.target.value)}
                                                    placeholder="örn: anthropic/claude-3-5-sonnet"
                                                    className="bg-white dark:bg-gray-800 border-purple-100 focus:border-purple-600"
                                                />
                                                <p className="text-[10px] text-gray-500 mt-1 italic">
                                                    * OpenRouter model kodunu tam olarak girin (örn: anthropic/claude-3-5-sonnet).
                                                </p>
                                            </div>
                                        )}
                                        
                                        <p className="text-[10px] text-gray-500 italic">
                                            * Kaydedilecek Teknik ID: <span className="font-mono text-purple-600">{selectedModel}</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 min-w-[120px]">
                                {saving ? "Kaydediliyor..." : <><Save className="w-4 h-4 mr-2" /> Ayarları Kaydet</>}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
