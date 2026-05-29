
import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, X } from "lucide-react";
import Block from '@uiw/react-color-block';
import { getAssetPath } from "@/lib/assetPath";
import { toast } from "sonner";

interface BackgroundControlsProps {
    selected: string;
    onWallpaperChange: (path: string) => void;
    showBlur?: boolean;
    onBlurChange?: (showBlur: boolean) => void;
}

const WALLPAPER_COUNT = 18;
const WALLPAPER_RELATIVE = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `wallpapers/wallpaper${i + 1}.jpg`);

const GRADIENTS = [
    "linear-gradient( 111.6deg,  rgba(114,167,232,1) 9.4%, rgba(253,129,82,1) 43.9%, rgba(253,129,82,1) 54.8%, rgba(249,202,86,1) 86.3% )",
    "linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)",
    "radial-gradient( circle farthest-corner at 3.2% 49.6%,  rgba(80,12,139,0.87) 0%, rgba(161,10,144,0.72) 83.6% )",
    "linear-gradient( 111.6deg,  rgba(0,56,68,1) 0%, rgba(163,217,185,1) 51.5%, rgba(231, 148, 6, 1) 88.6% )",
    "linear-gradient( 107.7deg,  rgba(235,230,44,0.55) 8.4%, rgba(252,152,15,1) 90.3% )",
    "linear-gradient( 91deg,  rgba(72,154,78,1) 5.2%, rgba(251,206,70,1) 95.9% )",
    "radial-gradient( circle farthest-corner at 10% 20%,  rgba(2,37,78,1) 0%, rgba(4,56,126,1) 19.7%, rgba(85,245,221,1) 100.2% )",
    "linear-gradient( 109.6deg,  rgba(15,2,2,1) 11.2%, rgba(36,163,190,1) 91.1% )",
    "linear-gradient(135deg, #FBC8B4, #2447B1)",
    "linear-gradient(109.6deg, #F635A6, #36D860)",
    "linear-gradient(90deg, #FF0101, #4DFF01)",
    "linear-gradient(315deg, #EC0101, #5044A9)",
    "linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)",
    "linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)",
    "linear-gradient(to right, #ff8177 0%, #ff867a 0%, #ff8c7f 21%, #f99185 52%, #cf556c 78%, #b12a5b 100%)",
    "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
    "linear-gradient(to right, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(to top, #fcc5e4 0%, #fda34b 15%, #ff7882 35%, #c8699e 52%, #7046aa 71%, #0c1db8 87%, #020f75 100%)",
    "linear-gradient(to right, #fa709a 0%, #fee140 100%)",
    "linear-gradient(to top, #30cfd0 0%, #330867 100%)",
    "linear-gradient(to top, #c471f5 0%, #fa71cd 100%)",
    "linear-gradient(to right, #f78ca0 0%, #f9748f 19%, #fd868c 60%, #fe9a8b 100%)",
    "linear-gradient(to top, #48c6ef 0%, #6f86d6 100%)",
    "linear-gradient(to right, #0acffe 0%, #495aff 100%)",
];

const COLOR_PALETTE = [
    '#FF0000', '#FFD700', '#00FF00', '#FFFFFF', '#0000FF', '#FF6B00',
    '#9B59B6', '#E91E63', '#00BCD4', '#FF5722', '#8BC34A', '#FFC107',
    '#34B27B', '#000000', '#607D8B', '#795548',
];

export function BackgroundControls({
    selected,
    onWallpaperChange,
    showBlur,
    onBlurChange,
}: BackgroundControlsProps) {
    const [wallpaperPaths, setWallpaperPaths] = useState<string[]>([]);
    const [customImages, setCustomImages] = useState<string[]>([]);
    const [selectedColor, setSelectedColor] = useState('#ADADAD');
    const [gradient, setGradient] = useState<string>(GRADIENTS[0]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const resolved = await Promise.all(WALLPAPER_RELATIVE.map(p => getAssetPath(p)));
                if (mounted) setWallpaperPaths(resolved);
            } catch (err) {
                if (mounted) setWallpaperPaths(WALLPAPER_RELATIVE.map(p => `/${p}`));
            }
        })();
        return () => { mounted = false; }
    }, []);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const validTypes = ['image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            toast.error('Invalid file type', { description: 'Please upload a JPG or JPEG image file.' });
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
                setCustomImages(prev => [...prev, dataUrl]);
                onWallpaperChange(dataUrl);
                toast.success('Custom image uploaded successfully!');
            }
        };
        reader.onerror = () => { toast.error('Failed to read file'); };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleRemoveCustomImage = (imageUrl: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setCustomImages(prev => prev.filter(img => img !== imageUrl));
        if (selected === imageUrl) {
            onWallpaperChange(wallpaperPaths[0] || WALLPAPER_RELATIVE[0]);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xs font-medium text-slate-200">Blur Background</div>
                <Switch
                    checked={showBlur}
                    onCheckedChange={onBlurChange}
                    className="data-[state=checked]:bg-[#34B27B]"
                />
            </div>

            <Tabs defaultValue="image" className="w-full">
                <TabsList className="mb-4 bg-white/5 border border-white/5 p-1 w-full grid grid-cols-3 h-auto rounded-xl">
                    <TabsTrigger value="image" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all text-xs">Image</TabsTrigger>
                    <TabsTrigger value="color" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all text-xs">Color</TabsTrigger>
                    <TabsTrigger value="gradient" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all text-xs">Gradient</TabsTrigger>
                </TabsList>

                <TabsContent value="image" className="mt-0 space-y-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept=".jpg,.jpeg,image/jpeg"
                        className="hidden"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="w-full gap-2 bg-white/5 text-slate-200 border-white/10 hover:bg-[#34B27B] hover:text-white hover:border-[#34B27B] transition-all h-8 text-xs"
                    >
                        <Upload className="w-3 h-3" />
                        Upload Custom
                    </Button>

                    <div className="grid grid-cols-6 gap-2">
                        {customImages.map((imageUrl, idx) => (
                            <div
                                key={`custom-${idx}`}
                                className={cn(
                                    "aspect-square rounded-md border-2 overflow-hidden cursor-pointer transition-all duration-200 relative group shadow-sm",
                                    selected === imageUrl ? "border-[#34B27B] ring-2 ring-[#34B27B]/30 scale-105" : "border-white/10 hover:border-[#34B27B]/40 opacity-80 hover:opacity-100 bg-white/5"
                                )}
                                style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
                                onClick={() => onWallpaperChange(imageUrl)}
                            >
                                <button
                                    onClick={(e) => handleRemoveCustomImage(imageUrl, e)}
                                    className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                    <X className="w-2 h-2 text-white" />
                                </button>
                            </div>
                        ))}

                        {(wallpaperPaths.length > 0 ? wallpaperPaths : WALLPAPER_RELATIVE.map(p => `/${p}`)).map((path) => {
                            const isSelected = (() => {
                                if (!selected) return false;
                                if (selected === path) return true;
                                try {
                                    // Simple relaxed check for file paths
                                    const s1 = selected.split('/').pop();
                                    const s2 = path.split('/').pop();
                                    return s1 === s2;
                                } catch { return false; }
                            })();

                            return (
                                <div
                                    key={path}
                                    className={cn(
                                        "aspect-square rounded-md border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm",
                                        isSelected ? "border-[#34B27B] ring-2 ring-[#34B27B]/30 scale-105" : "border-white/10 hover:border-[#34B27B]/40 opacity-80 hover:opacity-100 bg-white/5"
                                    )}
                                    style={{ backgroundImage: `url(${path})`, backgroundSize: "cover", backgroundPosition: "center" }}
                                    onClick={() => onWallpaperChange(path)}
                                />
                            )
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="color" className="mt-0">
                    <Block
                        color={selectedColor}
                        colors={COLOR_PALETTE}
                        onChange={(color) => {
                            setSelectedColor(color.hex);
                            onWallpaperChange(color.hex);
                        }}
                        style={{ width: '100%', borderRadius: '8px' }}
                    />
                </TabsContent>

                <TabsContent value="gradient" className="mt-0">
                    <div className="grid grid-cols-6 gap-2">
                        {GRADIENTS.map((g) => (
                            <div
                                key={g}
                                className={cn(
                                    "aspect-square rounded-md border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm",
                                    gradient === g ? "border-[#34B27B] ring-2 ring-[#34B27B]/30 scale-105" : "border-white/10 hover:border-[#34B27B]/40 opacity-80 hover:opacity-100 bg-white/5"
                                )}
                                style={{ background: g }}
                                onClick={() => { setGradient(g); onWallpaperChange(g); }}
                            />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
