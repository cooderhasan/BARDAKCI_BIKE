"use client";

import { MarketplaceCategoryPicker } from "@/components/admin/marketplace-category-picker";

/** HB için kısayol; ortak seçici: components/admin/marketplace-category-picker.tsx */
export function HbCategoryPicker(props: {
    onPick: (id: string, name: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}) {
    return <MarketplaceCategoryPicker marketplace="hepsiburada" placeholder={props.placeholder ?? "HB kategorisi ara (ör. elcik)..."} {...props} />;
}
