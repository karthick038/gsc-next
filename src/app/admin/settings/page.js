"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon, Upload, Globe, Image as ImageIcon, Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FaviconCropModal } from "@/components/admin/favicon-crop-modal";

export default function AdminSettingsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [settings, setSettings] = useState({
        siteTitle: "",
        logoUrl: "",
        faviconUrl: "",
        logoWidth: "",
        logoHeight: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [tempFaviconSrc, setTempFaviconSrc] = useState(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    setSettings({
                        ...data,
                        logoWidth: data.logoWidth || "",
                        logoHeight: data.logoHeight || "",
                    });
                }
            } catch (error) {
                console.error("Failed to fetch settings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // Sync browser tab branding in real-time
    useEffect(() => {
        if (!loading) {
            if (settings.siteTitle) document.title = settings.siteTitle;
            if (settings.faviconUrl) {
                let link = document.querySelector("link[rel~='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = settings.faviconUrl;
            }
        }
    }, [settings.siteTitle, settings.faviconUrl, loading]);

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith("image/")) {
            setMessage({ type: "error", text: "Please upload an image files" });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target.result;

            if (field === "faviconUrl") {
                // For favicon, we open the crop modal
                setTempFaviconSrc(result);
                // Check if it's already 32x32 (approximate check via Image)
                const img = new Image();
                img.onload = () => {
                    if (img.width === 32 && img.height === 32) {
                        // Exactly 32x32, we can skip and just set
                        setSettings(prev => ({ ...prev, [field]: result }));
                    } else {
                        setCropModalOpen(true);
                    }
                };
                img.src = result;
            } else {
                setSettings(prev => ({ ...prev, [field]: result }));
            }

            // Reset input so same file can be re-selected if needed
            e.target.value = "";
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage({ type: "", text: "" });

        // Production-grade validation & cleaning
        const siteTitle = settings.siteTitle?.trim() || "GSC Dashboard";

        // Ensure dimensions are positive integers if provided
        const logoWidth = settings.logoWidth ? Math.max(1, parseInt(settings.logoWidth)) : "";
        const logoHeight = settings.logoHeight ? Math.max(1, parseInt(settings.logoHeight)) : "";

        const payload = {
            ...settings,
            siteTitle,
            logoWidth,
            logoHeight
        };

        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                router.refresh();
                setMessage({ type: "success", text: "Settings saved successfully!" });
                setSettings(prev => ({ ...prev, siteTitle, logoWidth, logoHeight }));
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Failed to save settings" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Something went wrong" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Admin Settings</h1>
                    <p className="text-sm text-zinc-500 mt-1">Configure global branding and dashboard settings.</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-100 transition-all active:scale-95"
                >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Settings
                </Button>
            </div>

            {message.text && (
                <Alert variant={message.type === "success" ? "default" : "destructive"} className={message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}>
                    {message.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Site Title */}
                <Card className="border-zinc-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Globe className="h-5 w-5 text-blue-500" />
                            General Branding
                        </CardTitle>
                        <CardDescription>Update the site title that appears in the browser tab.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-zinc-700">Site Title</label>
                            <Input
                                value={settings.siteTitle}
                                onChange={(e) => setSettings({ ...settings, siteTitle: e.target.value })}
                                placeholder="e.g. My Custom Dashboard"
                                className="border-zinc-200 focus:ring-emerald-500"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Browser Favicon */}
                <Card className="border-zinc-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <SettingsIcon className="h-5 w-5 text-orange-500" />
                            Browser Favicon
                        </CardTitle>
                        <CardDescription>Small icon displayed in the browser tab.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-6 p-4 border border-zinc-100 rounded-lg bg-zinc-50/30">
                            <div className="h-16 w-16 bg-white border border-zinc-200 rounded flex items-center justify-center shadow-sm relative group overflow-hidden">
                                {settings.faviconUrl ? (
                                    <img
                                        key={settings.faviconUrl.slice(-10)} // Force re-render on value change
                                        src={settings.faviconUrl}
                                        alt="Favicon"
                                        className="h-10 w-10 object-contain"
                                    />
                                ) : (
                                    <div className="h-10 w-10 bg-zinc-100 rounded" />
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-zinc-700 mb-2">Icon Branding</label>
                                <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer shadow-sm">
                                    <Upload className="h-4 w-4" />
                                    {settings.faviconUrl ? 'Change Icon' : 'Upload Icon'}
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, "faviconUrl")}
                                    />
                                </label>
                                <p className="text-[10px] text-zinc-400 mt-2 italic font-medium">Recommended: 32x32px PNG/ICO</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Dashboard Logo */}
                <Card className="border-zinc-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <ImageIcon className="h-5 w-5 text-purple-500" />
                            Dashboard Logo
                        </CardTitle>
                        <CardDescription>Upload logo and set explicit dimensions (px).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-zinc-100 rounded-xl bg-zinc-50/50 relative group">
                            {settings.logoUrl ? (
                                <div className="relative group">
                                    <img
                                        key={settings.logoUrl.slice(-10)}
                                        src={settings.logoUrl}
                                        alt="Logo Preview"
                                        style={{
                                            maxWidth: '200px',
                                            maxHeight: '60px',
                                            objectFit: 'contain'
                                        }}
                                        className="transition-opacity group-hover:opacity-50"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <label className="cursor-pointer bg-white/90 px-3 py-1.5 rounded-full text-xs font-bold border border-zinc-200 flex items-center gap-2 shadow-sm">
                                            <Upload className="h-3.5 w-3.5" />
                                            Replace
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, "logoUrl")} />
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <ImageIcon className="h-10 w-10 text-zinc-200 mx-auto mb-2" />
                                    <label className="cursor-pointer text-emerald-600 font-bold hover:underline">
                                        Upload Logo
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, "logoUrl")} />
                                    </label>
                                    <p className="text-[11px] text-zinc-400 mt-1">Recommended: 160x40 (Transparent PNG)</p>
                                </div>
                            )}
                        </div>

                        {/* Dimensions Row */}
                        <div className="pt-4 border-t border-zinc-100">
                            <label className="text-sm font-bold text-zinc-700 mb-3 block">Logo Dimensions (Width × Height)</label>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="Auto"
                                        value={settings.logoWidth}
                                        onChange={(e) => setSettings({ ...settings, logoWidth: e.target.value })}
                                        className="h-10 border-zinc-200 focus:ring-emerald-500 pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 uppercase">W</span>
                                </div>
                                <span className="text-zinc-300 font-bold">×</span>
                                <div className="relative flex-1">
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="Auto"
                                        value={settings.logoHeight}
                                        onChange={(e) => setSettings({ ...settings, logoHeight: e.target.value })}
                                        className="h-10 border-zinc-200 focus:ring-emerald-500 pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 uppercase">H</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-2 italic font-medium">Leave blank for auto-resizing based on aspect ratio.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <FaviconCropModal
                isOpen={cropModalOpen}
                onOpenChange={setCropModalOpen}
                imageSrc={tempFaviconSrc}
                onCropComplete={(croppedImage) => {
                    setSettings(prev => ({ ...prev, faviconUrl: croppedImage }));
                }}
            />
        </div>
    );
}
