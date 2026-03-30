import { useState } from 'react';

/**
 * Custom hook to manage the state and logic for the CardPopup component.
 * This hook encapsulates the state variables and their setters, allowing
 * for easy reuse across different components.
 */
export const useCardPopup = () => {
    const [isCardPopupOpen, setIsCardPopupOpen] = useState(false);
    const [popupContent, setPopupContent] = useState({
        title: '',
        content: '',
        isEditable: false,
        itemId: null,
        field: '',
        contentType: '',
    });

    /**
     * Opens the CardPopup with the given content.
     * @param {string} title The title of the popup.
     * @param {string} content The content to display in the popup.
     * @param {boolean} isEditable Whether the content should be editable.
     * @param {any} itemId The ID of the item being edited (optional).
     * @param {string} field The specific field of the item being edited (optional).
     * @param {string} contentType The type of content to be displayed/edited (optional, e.g., 'customValues').
     */
    const openCardPopup = (title, content, isEditable = false, itemId = null, field = '', contentType = 'textarea') => {
        setPopupContent({ title, content, isEditable, itemId, field, contentType });
        setIsCardPopupOpen(true);
    };

    /**
     * Closes the CardPopup and resets its state.
     */
    const closeCardPopup = () => {
        setIsCardPopupOpen(false);
        setPopupContent({
            title: '',
            content: '',
            isEditable: false,
            itemId: null,
            field: '',
            contentType: '',
        });
    };

    return {
        isCardPopupOpen,
        popupContent,
        openCardPopup,
        closeCardPopup,
        setPopupContent,
    };
};