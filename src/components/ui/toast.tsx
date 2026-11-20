"use client";

import { Toast } from "@base-ui/react/toast";
import { CircleCheck, TriangleAlert, X } from "lucide-react";

const toastManager = Toast.createToastManager();

const show = (type: "success" | "error", message: string) =>
  toastManager.add({ description: message, type, priority: type === "error" ? "high" : "low" });

// Confirms an action that otherwise only changes the page quietly. Errors stay next to the control that caused them.
export const notify = (message: string) => show("success", message);

// For a failure with nowhere to stay on screen, such as a menu action that closes the menu.
export const notifyError = (message: string) => show("error", message);

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="flex items-center gap-2.5 rounded-lg border bg-popover px-3.5 py-2.5 text-sm text-popover-foreground shadow-lg transition-all duration-200 data-ending:translate-y-2 data-ending:opacity-0 data-limited:hidden data-starting:translate-y-2 data-starting:opacity-0"
    >
      {toast.type === "error" ? (
        <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
      ) : (
        <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
      )}
      <Toast.Description className="min-w-0 flex-1" />
      <Toast.Close
        aria-label="Dismiss"
        className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2"
      >
        <X aria-hidden className="size-3.5" />
      </Toast.Close>
    </Toast.Root>
  ));
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} timeout={4000} limit={3}>
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
