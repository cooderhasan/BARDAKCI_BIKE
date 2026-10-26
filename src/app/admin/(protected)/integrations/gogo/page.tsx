import { getGogoConfig } from "./actions";
import { GogoStockPanel } from "./gogo-stock-panel";

export const dynamic = "force-dynamic";

export default async function GogoStockPage() {
    const settings = await getGogoConfig();
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Gogo Stok (XML)</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Gogo Moto Aksesuar XML&apos;indeki stoklar, motor sitesinde aynı ürün koduna sahip ürünlere yazılır. Fiyata dokunulmaz;
                    sitede olmayan ürünler atlanır.
                </p>
            </div>
            <GogoStockPanel initial={settings} />
        </div>
    );
}
