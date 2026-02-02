
/**
 * Creates an image from a source URL
 */
export const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.setAttribute("crossOrigin", "anonymous");
        image.src = url;
    });

/**
 * Gets the cropped image as a Base64 string at exactly 32x32 pixels
 */
export async function getCroppedFavicon(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        return null;
    }

    // Set the canvas size to the target 32x32
    canvas.width = 32;
    canvas.height = 32;

    // Draw the cropped portion of the original image into the 32x32 canvas
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        32,
        32
    );

    return canvas.toDataURL("image/png");
}
