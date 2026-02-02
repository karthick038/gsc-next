
"use client";

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedFavicon } from "@/lib/image-utils";
import { Loader2, Scissors } from "lucide-react";

export function FaviconCropModal({ isOpen, onOpenChange, imageSrc, onCropComplete }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedPixelCrop, setCroppedPixelCrop] = useState(null);
    const [processing, setProcessing] = useState(false);

    const onCropChange = (crop) => {
        setCrop(crop);
    };

    const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedPixelCrop(croppedAreaPixels);
    }, []);

    const handleConfirm = async () => {
        if (!croppedPixelCrop || !imageSrc) return;

        setProcessing(true);
        try {
            const croppedImage = await getCroppedFavicon(imageSrc, croppedPixelCrop);
            onCropComplete(croppedImage);
            onOpenChange(false);
        } catch (e) {
            console.error("Error cropping image", e);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scissors className="h-5 w-5 text-orange-500" />
                        Crop Favicon (32×32)
                    </DialogTitle>
                    <DialogDescription>
                        Select the area for your site favicon. It will be automatically resized to 32×32 pixels.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative h-[300px] w-full bg-zinc-900 rounded-lg overflow-hidden mt-4">
                    {imageSrc && (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={onCropChange}
                            onCropComplete={onCropCompleteCallback}
                            onZoomChange={setZoom}
                        />
                    )}
                </div>

                <div className="mt-4 space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Zoom</label>
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                </div>

                <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={processing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                        {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Apply Crop
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
