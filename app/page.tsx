"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useDropzone } from "react-dropzone"
import imageCompression from "browser-image-compression"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { Montserrat } from "next/font/google"
import { DownloadMinimalistic, Gallery, Settings, TrashBinMinimalistic, Lock} from "solar-icon-set"
import { Tabs, Tab, Modal,  ModalContent,  ModalHeader,  ModalBody,  ModalFooter, useDisclosure, Card, CardBody, Button, Slider, Spinner} from "@heroui/react";
import { cn } from "@/lib/utils"
import { Toaster } from "react-hot-toast"
import { CookieConsent } from "@/components/cookie-consent"

const montserrat = Montserrat({ subsets: ["latin"] })

// Types
interface ProcessedImage {
    id: string
    originalFile: File
    compressedFile: File
    originalSize: number
    compressedSize: number
    previewUrl: string
    timestamp: number
}

interface CompressionSettings {
    maxSizeMB: number
    maxWidthOrHeight: number
    quality: number
}

// Zustand store
interface CompressorState {
    processedImages: ProcessedImage[]
    history: ProcessedImage[]
    settings: CompressionSettings
    addProcessedImage: (image: ProcessedImage) => void
    clearProcessedImages: () => void
    removeFromHistory: (id: string) => void
    clearHistory: () => void
    updateSettings: (settings: Partial<CompressionSettings>) => void
}

const useCompressorStore = create<CompressorState>()(
  persist(
    (set) => ({
        processedImages: [],
        history: [],
        settings: {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            quality: 0.8,
        },
        addProcessedImage: (image) =>
            set((state) => ({
                processedImages: [...state.processedImages, image],
                history: [...state.history, image],
            })),
        clearProcessedImages: () =>
            set((state) => ({
                processedImages: [],
            })),
        removeFromHistory: (id) =>
            set((state) => ({
                history: state.history.filter((image) => image.id !== id),
            })),
        clearHistory: () =>
            set((state) => ({
                history: [],
            })),
        updateSettings: (newSettings) =>
            set((state) => ({
                settings: { ...state.settings, ...newSettings },
            })),
        }),
    {
      name: "image-compressor-storage",
    },
  ),
)

export default function ImageCompressor() {

    const {isOpen, onOpen, onOpenChange} = useDisclosure()

    const {
        processedImages,
        history,
        settings,
        addProcessedImage,
        clearProcessedImages,
        removeFromHistory,
        clearHistory,
        updateSettings,
    } = useCompressorStore()
    const [isProcessing, setIsProcessing] = useState(false)
    const [activeTab, setActiveTab] = useState("compress")
    const [cookiesAccepted, setCookiesAccepted] = useState(false)

    useEffect(() => {
        // Check if user has already accepted cookies
        const hasAccepted = localStorage.getItem("cookiesAccepted") === "true"
        setCookiesAccepted(hasAccepted)
    }, [])

    const handleAcceptCookies = () => {
        localStorage.setItem("cookiesAccepted", "true")
        setCookiesAccepted(true)
    }

    const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
        accept: {
        "image/*": [".png", ".jpg", ".jpeg", ".webp"],
        },
        onDrop: (acceptedFiles) => {
        if (cookiesAccepted) {
            handleCompression(acceptedFiles)
        }
        },
        disabled: !cookiesAccepted,
    })

    async function handleCompression(files: File[]) {
        if (files.length === 0 || !cookiesAccepted) return

        setIsProcessing(true)

        try {
        for (const file of files) {
            const options = {
            maxSizeMB: settings.maxSizeMB,
            maxWidthOrHeight: settings.maxWidthOrHeight,
            useWebWorker: true,
            initialQuality: settings.quality,
            }

            // First compress the image with browser-image-compression
            const compressedFile = await imageCompression(file, options)

            // Then convert to WebP using Canvas
            const webpFile = await convertToWebP(compressedFile, settings.quality)

            const originalSizeKB = file.size / 1024
            const compressedSizeKB = webpFile.size / 1024

            // Create a blob URL for preview
            const previewUrl = URL.createObjectURL(webpFile)

            const processedImage: ProcessedImage = {
            id: `${file.name || "image"}-${Date.now()}`,
            originalFile: file,
            compressedFile: webpFile,
            originalSize: originalSizeKB,
            compressedSize: compressedSizeKB,
            previewUrl,
            timestamp: Date.now(),
            }

            addProcessedImage(processedImage)
        }
        } catch (error) {
        console.error("Error compressing images:", error)
        } finally {
        setIsProcessing(false)
        }
    }

    async function convertToWebP(file: File, quality: number): Promise<File> {
        return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
            // Create canvas
            const canvas = document.createElement("canvas")
            canvas.width = image.width
            canvas.height = image.height

            // Draw image on canvas
            const ctx = canvas.getContext("2d")
            if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
            }

            ctx.drawImage(image, 0, 0)

            // Convert to WebP
            canvas.toBlob(
            (blob) => {
                if (!blob) {
                reject(new Error("Could not create WebP blob"))
                return
                }

                // Get original filename without extension
                const fileName = file.name || "image"
                const lastDotIndex = fileName.lastIndexOf(".")
                const originalName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName

                // Create new File with WebP extension
                const webpFile = new File([blob], `${originalName}.webp`, { type: "image/webp" })
                resolve(webpFile)
            },
            "image/webp",
            quality,
            )
        }

        image.onerror = () => {
            reject(new Error("Error loading image"))
        }

        // Load image from file
        image.src = URL.createObjectURL(file)
        })
    }

    function handleDownload(image: ProcessedImage) {
        if (!cookiesAccepted || !image || !image.compressedFile) return

        const link = document.createElement("a")
        link.href = URL.createObjectURL(image.compressedFile)

        // Get original filename without extension
        const fileName = image.originalFile?.name || "image"
        const lastDotIndex = fileName.lastIndexOf(".")
        const originalName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName

        // Set download name with WebP extension
        link.download = `${originalName}.webp`

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    function formatFileSize(sizeInKB: number): string {
        return sizeInKB < 1024 ? `${sizeInKB.toFixed(2)} KB` : `${(sizeInKB / 1024).toFixed(2)} MB`
    }

    function formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString()
    }

    function getWebpFilename(originalFilename = "image"): string {
        // Safely handle undefined or null values
        if (!originalFilename) return "image.webp"

        // Get filename without extension
        const lastDotIndex = originalFilename.lastIndexOf(".")
        const nameWithoutExt = lastDotIndex !== -1 ? originalFilename.substring(0, lastDotIndex) : originalFilename
        return `${nameWithoutExt}.webp`
    }

    return (
        <div className={cn("min-h-screen bg-background p-4 md:p-8", montserrat.className)}>
        {!cookiesAccepted && <CookieConsent onAccept={handleAcceptCookies} />}
        <Toaster />

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
        >
            <header className="text-center mb-8">
            <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-3xl md:text-4xl font-bold text-primary mb-2"
            >
                Сжатие изображений
            </motion.h1>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-muted-foreground"
            >
                Сжимайте ваши изображения без потери качества
            </motion.p>
            </header>

            <Tabs className="gap-5 flex place-content-center" variant="solid" aria-label="Options">
                <Tab className="m-auto flex flex-col gap-4" key="compress" title="Обработка">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Загрузите фотографии</h2>
                        <Button
                            color="primary"
                            disabled={!cookiesAccepted}
                            startContent={<Settings size={18} iconStyle="LineDuotone" />}
                            onPress={onOpen}
                        >
                            Настройки
                        </Button>
                        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                            <ModalContent>
                                {(onClose) => (
                                    <>
                                        <ModalHeader>Настройки</ModalHeader>
                                        <ModalBody>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium">Качество ({(settings.quality * 100).toFixed(0)}%)</label>
                                                </div>
                                                <Slider
                                                    value={[settings.quality * 100]}
                                                    minValue={10}
                                                    maxValue={100}
                                                    step={1}
                                                    size="lg"
                                                    onChange={(value) => updateSettings({ quality: Number(value) / 100 })}
                                                />
                                                </div>

                                                <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium">Макс. размер (MB)</label>
                                                </div>
                                                <Slider
                                                    value={[settings.maxSizeMB]}
                                                    minValue={0.1}
                                                    maxValue={10}
                                                    step={0.1}
                                                    size="lg"
                                                    onChange={(value) => updateSettings({ maxSizeMB: Number(value) })}
                                                />
                                                <div className="text-xs text-muted-foreground">{settings.maxSizeMB.toFixed(1)} MB</div>
                                                </div>

                                                <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium">Макс. Высота/Ширина (px)</label>
                                                </div>
                                                <Slider
                                                    value={[settings.maxWidthOrHeight]}
                                                    minValue={500}
                                                    maxValue={4000}
                                                    step={100}
                                                    size="lg"
                                                    onChange={(value) => updateSettings({ maxWidthOrHeight: Number(value) })}
                                                />
                                                <div className="text-xs text-muted-foreground">{settings.maxWidthOrHeight} px</div>
                                                </div>
                                            </div>
                                        </ModalBody>
                                        <ModalFooter>
                                            <Button
                                                onPress={onClose}
                                                variant="flat"
                                                color="danger"
                                            >
                                                Закрыть
                                            </Button>
                                        </ModalFooter>
                                    </>
                                )}
                            </ModalContent>
                        </Modal>
                    </div>

                    <div className="flex flex-col gap-10">
                        <div
                            // whileHover={{ scale: isDragActive && cookiesAccepted ? 1 : 1.01 }}
                            // whileTap={{ scale: cookiesAccepted ? 0.99 : 1 }}
                            className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center hover:cursor-pointer hover:bg-default-200 transition ease-linear",
                            isDragActive && cookiesAccepted ? "border-primary bg-primary/5" : "border-muted-foreground/20",
                            !cookiesAccepted && "opacity-50 cursor-not-allowed",
                            )}
                            {...getRootProps()}
                        >
                            <input {...getInputProps()} disabled={!cookiesAccepted} />
                            <div className="flex flex-col items-center justify-center gap-2">
                            <Gallery size={40} iconStyle="LineDuotone" />
                            {isDragActive && cookiesAccepted ? (
                                <p className="text-primary font-medium">Бросьте файлы сюда...</p>
                            ) : (
                                <>
                                <p className="font-medium">
                                    {cookiesAccepted
                                    ? "Перенесите и бросьте файлы сюда или нажмите для выбора"
                                    : "Примите куки для доступа"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Поддерживает : JPG, PNG, WEBP (Макс. {settings.maxSizeMB}MB)
                                </p>
                                </>
                            )}
                            </div>
                        </div>

                        {!cookiesAccepted && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Lock size={32} iconStyle="LineDuotone" />
                                <p>Примите куки для доступа</p>
                            </div>
                            </div>
                        )}
                    </div>

                    {isProcessing && (
                    <div className="flex justify-center items-center py-8">
                        <Spinner />
                        <span className="ml-2 text-muted-foreground">Сжимаем фотографии...</span>
                    </div>
                    )}

                    {processedImages.length > 0 && (
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-semibold">Сжатые фотографии</h2>
                                <Button color="danger" size="sm" onPress={clearProcessedImages} disabled={!cookiesAccepted}>
                                    <TrashBinMinimalistic size={18} iconStyle="LineDuotone" />
                                    Очистить
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AnimatePresence>
                                    {processedImages.map((image) => (
                                    <motion.div
                                        key={image.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Card>
                                            <CardBody className="p-4">
                                                <div className="aspect-video relative overflow-hidden rounded-md mb-3">
                                                <img
                                                    src={image.previewUrl || "/placeholder.svg"}
                                                    alt={image.originalFile?.name || "Compressed image"}
                                                    className="object-contain w-full h-full"
                                                />
                                                </div>
                                                <div className="space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <div className="truncate max-w-[70%]">
                                                    <h3 className="font-medium truncate">{getWebpFilename(image.originalFile?.name)}</h3>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onPress={() => handleDownload(image)}
                                                        disabled={!cookiesAccepted}
                                                        color="primary"
                                                        variant="flat"
                                                    >
                                                        <DownloadMinimalistic size={18} iconStyle="LineDuotone" />
                                                        Скачать
                                                    </Button>
                                                </div>
                                                <div className="text-sm text-muted-foreground space-y-1">
                                                    <div className="flex justify-between">
                                                        <span>Оригинал:</span>
                                                        <span>{formatFileSize(image.originalSize)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Сжали до:</span>
                                                        <span>{formatFileSize(image.compressedSize)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Сжатие:</span>
                                                        <span className="text-green-500">
                                                            {((1 - image.compressedSize / image.originalSize) * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </Tab>
                <Tab key="history" title="История">
                    <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">История</h2>
                        {history.length > 0 && (
                        <Button color="danger" size="sm" onPress={clearHistory} disabled={!cookiesAccepted}>
                            <TrashBinMinimalistic className="h-4 w-4 mr-2" />
                            Очистить
                        </Button>
                        )}
                    </div>

                    {history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Нет истории</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                        {[...history].reverse().map((image) => (
                            <motion.div
                            key={image.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            >
                            <Card>
                                <CardBody className="p-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded overflow-hidden flex-shrink-0">
                                    <img
                                        src={image.previewUrl || "/placeholder.svg"}
                                        alt={image.originalFile?.name || "Compressed image"}
                                        className="h-full w-full object-cover"
                                    />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                    <h3 className="font-medium truncate">{getWebpFilename(image.originalFile?.name)}</h3>
                                    <p className="text-xs text-muted-foreground">{formatDate(image.timestamp)}</p>
                                    <div className="flex gap-4 text-sm mt-1">
                                        <span>
                                        {formatFileSize(image.originalSize)} → {formatFileSize(image.compressedSize)}
                                        </span>
                                        <span className="text-green-500">
                                            Сохранено: {((1 - image.compressedSize / image.originalSize) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="flat"
                                            size="sm"
                                            onPress={() => handleDownload(image)}
                                            isIconOnly
                                            color="primary"
                                            disabled={!cookiesAccepted}
                                        >
                                            <DownloadMinimalistic size={18} iconStyle="LineDuotone" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            onPress={() => removeFromHistory(image.id)}
                                            isIconOnly
                                            color="danger"
                                            disabled={!cookiesAccepted}
                                        >
                                            <TrashBinMinimalistic size={18} iconStyle="LineDuotone" />
                                        </Button>
                                    </div>
                                </div>
                                </CardBody>
                            </Card>
                            </motion.div>
                        ))}
                        </div>
                    )}
                    </div>
                </Tab>
            </Tabs>
        </motion.div>
        </div>
    )
}
