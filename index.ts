/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { MessageStore } from "@webpack/common";

// CSS for styling the ":3" text
const style = document.createElement("style");
style.textContent = `
.vc-cat-pink {
    color: #ff66b2 !important;
    font-weight: bold;
}

/* Target Discord's message content directly */
.markup__75297 span:not(.vc-cat-pink) {
    color: inherit;
}

/* Style for the visual :3 */
.vc-cat-visual {
    position: relative;
}

.vc-cat-visual::after {
    content: ":3";
    color: #ff66b2;
    font-weight: bold;
    margin-left: 2px;
}
`;

const settings = definePluginSettings({
    appendCat: {
        type: OptionType.BOOLEAN,
        description: "Append :3 to messages",
        default: true,
        restartNeeded: false
    },
    visualCat: {
        type: OptionType.BOOLEAN,
        description: "Make every message appear to end with :3",
        default: false,
        restartNeeded: false
    }
});

export default definePlugin({
    name: "Cat Bookend",
    description: "Appends :3 to messages that don't end with it and makes all :3 pink",
    version: "1.0.0",
    authors: [{ name: "user", id: 0n }],
    settings,

    start() {
        // Add the CSS to the document
        document.head.appendChild(style);

        // Set up the observer to watch for new messages
        this.setupObserver();

        // Process existing messages
        this.processExistingMessages();

        // Add message pre-send listener
        this.listener = addMessagePreSendListener((_, message) => {
            if (settings.store.appendCat && message.content && !message.content.trim().endsWith(":3")) {
                message.content = message.content.trim() + " :3";
            }
        });
    },

    stop() {
        // Remove the CSS from the document
        style.remove();

        // Disconnect the observer if it exists
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Remove the message pre-send listener
        this.listener?.();

        // Revert changes to existing messages
        this.revertChanges();
    },

    observer: null as MutationObserver | null,

    setupObserver() {
        // Create a MutationObserver to watch for changes to the DOM
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    // Check for new message content elements
                    const messageContents = document.querySelectorAll(".markup__75297.messageContent_c19a55:not(.vc-cat-processed)");

                    for (const messageContent of messageContents) {
                        this.processMessageContent(messageContent as HTMLElement);
                    }
                }
            }
        });

        // Start observing the document
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Store the observer so we can disconnect it later
        this.observer = observer;
    },

    processExistingMessages() {
        // Find all message content elements
        const messageContents = document.querySelectorAll(".markup__75297.messageContent_c19a55:not(.vc-cat-processed)");

        for (const messageContent of messageContents) {
            this.processMessageContent(messageContent as HTMLElement);
        }
    },

    processMessageContent(element: HTMLElement) {
        // Mark this element as processed to avoid processing it again
        element.classList.add("vc-cat-processed");

        // Get the HTML content
        const html = element.innerHTML;

        // Replace instances of ":3" with styled spans
        const newHtml = html.replace(/:3/g, '<span class="vc-cat-pink">:3</span>');

        // Only update if there was a change
        if (newHtml !== html) {
            element.innerHTML = newHtml;
        }

        // Add visual :3 if enabled
        if (settings.store.visualCat) {
            element.classList.add("vc-cat-visual");

            // Get the message ID from the element
            const messageId = element.closest("[data-message-id]")?.getAttribute("data-message-id");
            if (messageId) {
                // Get the message from Discord's store
                const message = MessageStore.getMessage(element.closest("[data-channel-id]")?.getAttribute("data-channel-id")!, messageId);
                if (message && !message.content.trim().endsWith(":3")) {
                    // Update the message content
                    message.content = message.content.trim() + " :3";
                }
            }
        } else {
            element.classList.remove("vc-cat-visual");
        }
    },

    revertChanges() {
        // Find all processed message content elements
        const processedElements = document.querySelectorAll(".vc-cat-processed");

        for (const element of processedElements) {
            // Remove the processed class
            element.classList.remove("vc-cat-processed");
            element.classList.remove("vc-cat-visual");

            // Find all pink :3 spans
            const pinkSpans = element.querySelectorAll(".vc-cat-pink");

            // Replace each span with its text content
            for (const span of pinkSpans) {
                const text = span.textContent || "";
                const textNode = document.createTextNode(text);
                span.parentNode?.replaceChild(textNode, span);
            }
        }
    },

    // Patch the message content renderer to ensure we catch all messages
    patches: [
        {
            find: "#{intl::MESSAGE_EDITED}",
            replacement: {
                match: /(\)\("div",\{id:.+?children:\[)/,
                replace: "$1$self.patchMessageContent(arguments[0]),"
            }
        }
    ],

    // Function to ensure we process message content after it's rendered
    patchMessageContent(props: any) {
        if (!props || !props.message) return null;

        // Use setTimeout to ensure the message is rendered before we process it
        setTimeout(() => {
            const messageId = props.message.id;
            if (!messageId) return;

            const messageContent = document.querySelector(`#message-content-${messageId}`);
            if (messageContent && !messageContent.classList.contains("vc-cat-processed")) {
                this.processMessageContent(messageContent as HTMLElement);
            }
        }, 0);

        return null;
    }
});
