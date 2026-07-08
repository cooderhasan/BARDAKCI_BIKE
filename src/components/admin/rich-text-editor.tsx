"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Link as LinkIcon,
    Heading1,
    Heading2,
    Undo,
    Redo,
    Eraser,
    Code,
    ImagePlus,
    Tag,
    Loader2,
} from "lucide-react";

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [showSource, setShowSource] = useState(false);
    const [sourceCode, setSourceCode] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-[#17457C] underline",
                },
            }),
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            Underline,
            Image.configure({
                HTMLAttributes: {
                    class: "rounded-lg max-w-full h-auto mx-auto block my-4",
                },
            }),
        ],
        content,
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none min-h-[200px] p-4 focus:outline-none",
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const setLink = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes("link").href;
        const url = window.prompt("URL:", previousUrl);

        if (url === null) return;
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }, [editor]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !editor) return;

        const file = e.target.files[0];

        // Basic client-side validation
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Lütfen sadece JPEG, PNG, WebP veya GIF formatında bir görsel yükleyin.");
            return;
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            toast.error("Görsel boyutu 5MB'ı aşamaz.");
            return;
        }

        setUploadingImage(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Yükleme başarısız");
            }

            const data = await res.json();
            const url = data.url;

            // Prompt user for Alt Tag / Description (SEO)
            const defaultAlt = file.name.split(".")[0];
            const altText = window.prompt("Görsel için açıklama girin (SEO Alt Etiketi):", defaultAlt);

            if (altText !== null) {
                editor
                    .chain()
                    .focus()
                    .setImage({ src: url, alt: altText, title: altText })
                    .run();
                toast.success("Görsel başarıyla yüklendi ve eklendi.");
            } else {
                editor
                    .chain()
                    .focus()
                    .setImage({ src: url, alt: "", title: "" })
                    .run();
                toast.success("Görsel eklendi.");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Görsel yüklenirken bir hata oluştu.");
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = ""; // Reset file input
            }
        }
    };

    const handleEditAltText = useCallback(() => {
        if (!editor) return;
        const attrs = editor.getAttributes("image");
        const currentAlt = attrs.alt || "";
        const newAlt = window.prompt("Görsel Açıklamasını Düzenle (SEO Alt Etiketi):", currentAlt);

        if (newAlt !== null) {
            editor.chain().focus().updateAttributes("image", { alt: newAlt, title: newAlt }).run();
            toast.success("Alt etiketi güncellendi.");
        }
    }, [editor]);

    if (!isMounted) {
        return (
            <div className="border rounded-lg p-4 min-h-[200px] bg-gray-50 animate-pulse">
                <p className="text-gray-400">{placeholder || "Yükleniyor..."}</p>
            </div>
        );
    }

    if (!editor) {
        return null;
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive("bold") ? "bg-gray-200" : ""}
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive("italic") ? "bg-gray-200" : ""}
                >
                    <Italic className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={editor.isActive("underline") ? "bg-gray-200" : ""}
                >
                    <UnderlineIcon className="h-4 w-4" />
                </Button>

                <div className="w-px bg-gray-300 mx-1" />

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive("heading", { level: 1 }) ? "bg-gray-200" : ""}
                >
                    <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive("heading", { level: 2 }) ? "bg-gray-200" : ""}
                >
                    <Heading2 className="h-4 w-4" />
                </Button>

                <div className="w-px bg-gray-300 mx-1" />

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive("bulletList") ? "bg-gray-200" : ""}
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive("orderedList") ? "bg-gray-200" : ""}
                >
                    <ListOrdered className="h-4 w-4" />
                </Button>

                <div className="w-px bg-gray-300 mx-1" />

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    className={editor.isActive({ textAlign: "left" }) ? "bg-gray-200" : ""}
                >
                    <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    className={editor.isActive({ textAlign: "center" }) ? "bg-gray-200" : ""}
                >
                    <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    className={editor.isActive({ textAlign: "right" }) ? "bg-gray-200" : ""}
                >
                    <AlignRight className="h-4 w-4" />
                </Button>

                <div className="w-px bg-gray-300 mx-1" />

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={setLink}
                    className={editor.isActive("link") ? "bg-gray-200" : ""}
                    title="Bağlantı Ekle"
                >
                    <LinkIcon className="h-4 w-4" />
                </Button>

                <div className="w-px bg-gray-300 mx-1" />

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                />

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    title="Görsel Yükle ve Ekle"
                    className="hover:text-indigo-600"
                >
                    {uploadingImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <ImagePlus className="h-4 w-4" />
                    )}
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleEditAltText}
                    disabled={!editor.isActive("image")}
                    className={editor.isActive("image") ? "text-indigo-600 hover:text-indigo-700 bg-indigo-50 animate-pulse" : "text-gray-400"}
                    title="Görsel Alt Etiketini Düzenle"
                >
                    <Tag className="h-4 w-4" />
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (window.confirm("Metnin içindeki GÖRÜNEN tüm HTML etiketlerini (<p>, <div> vb.) temizlemek ve satırları sıkılaştırmak istiyor musunuz?")) {
                            // 1. Get the text content (which might include literal "<p>" strings if user pasted source code)
                            let text = editor.getText();

                            // 2. Remove literal HTML tags (e.g. user pasted "<b>Bolu</b>" generic text)
                            text = text.replace(/<\/?[^>]+(>|$)/g, " ");

                            // 3. Trim extra whitespace
                            text = text.replace(/\s+/g, ' ').trim();

                            // 4. Wrap in a single paragraph (Tiptap structure requirement)
                            // Note: We use a simple paragraph. The result is just text.
                            const cleanHtml = `<p>${text}</p>`;

                            editor.commands.setContent(cleanHtml);
                        }
                    }}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    title="Derinlemesine Temizlik (HTML Kodlarını Temizle)"
                >
                    <Eraser className="h-4 w-4" />
                </Button>

                <div className="w-px bg-gray-300 mx-1" />

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (!showSource) {
                            // Switching to Source Mode
                            // Get current HTML and set it to local state for textarea
                            setSourceCode(editor.getHTML());
                        } else {
                            // Switching back to Visual Mode
                            // Save changes from textarea back to editor
                            editor.commands.setContent(sourceCode);
                        }
                        setShowSource(!showSource);
                    }}
                    className={showSource ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : ""}
                    title="Kaynak Kodu (HTML) Düzenle"
                >
                    <Code className="h-4 w-4" />
                </Button>
            </div>

            {/* Editor Content or Source Textarea */}
            {showSource ? (
                <textarea
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    className="w-full h-[200px] p-4 font-mono text-sm bg-gray-900 text-green-400 focus:outline-none resize-y"
                    spellCheck={false}
                />
            ) : (
                <EditorContent editor={editor} />
            )}
        </div>
    );
}
