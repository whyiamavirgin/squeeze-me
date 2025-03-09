"use client"

import { useEffect } from "react"
import toast from "react-hot-toast"
import { Button } from "@heroui/react"

interface CookieConsentProps {
  onAccept: () => void
}

export function CookieConsent({ onAccept }: CookieConsentProps) {
  useEffect(() => {
    // Show the toast notification
    const toastId = toast(
      (t) => (
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1">
            <p className="font-medium">Этот сайт использует куки</p>
            <p className="text-sm text-muted-foreground">
              Мы используем куки для обеспечения работы сайта. Продолжая использовать сайт, вы соглашаетесь с
              использованием файлов cookie.
            </p>
          </div>
          <Button
            onPress={() => {
              onAccept()
              toast.dismiss(t.id)
            }}
            size="sm"
          >
            Принять
          </Button>
        </div>
      ),
      {
        duration: Number.POSITIVE_INFINITY,
        position: "bottom-center",
        style: {
          maxWidth: "500px",
          width: "100%",
          padding: "16px",
          borderRadius: "8px",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          zIndex: 9999,
        },
      },
    )

    return () => {
      toast.dismiss(toastId)
    }
  }, [onAccept])

  return null
}

