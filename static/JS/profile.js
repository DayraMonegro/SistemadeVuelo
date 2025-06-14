// static/js/profile.js

document.addEventListener('DOMContentLoaded', function() {
    // Selecciona los elementos DOM necesarios
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const displayProfileSection = document.getElementById('display-profile');
    const editProfileFormSection = document.getElementById('edit-profile-form');
    const newUsernameInput = document.getElementById('new-username');
    const currentUsernameSpan = document.getElementById('current-username'); // Elemento que muestra el nombre de usuario actual

    // Función para mostrar el formulario de edición y ocultar la sección de visualización
    function showEditForm() {
        displayProfileSection.style.display = 'none'; // Oculta la parte de "ver perfil"
        editProfileFormSection.style.display = 'block'; // Muestra la parte de "editar perfil"
        newUsernameInput.value = currentUsernameSpan.textContent.trim(); // Rellena el input con el username actual
    }

    // Función para ocultar el formulario de edición y mostrar la sección de visualización
    function hideEditForm() {
        editProfileFormSection.style.display = 'none'; // Oculta la parte de "editar perfil"
        displayProfileSection.style.display = 'block'; // Muestra la parte de "ver perfil"
    }

    // AÑADIR LISTENERS SOLO SI LOS ELEMENTOS EXISTEN
    // Esto previene errores si los elementos no están en la página por alguna razón.

    // Listener para el botón "Editar Perfil"
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', showEditForm);
    }

    // Listener para el botón "Cancelar"
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', hideEditForm);
    }

    // Listener para el botón "Guardar Cambios"
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            const newUsername = newUsernameInput.value.trim(); // Obtiene el nuevo nombre de usuario del input

            // Validación básica del lado del cliente
            if (!newUsername) {
                alert('El nombre de usuario no puede estar vacío.');
                return;
            }

            const oldUsername = currentUsernameSpan.textContent.trim(); // Obtiene el nombre de usuario actualmente visible

            // Si el nombre de usuario no ha cambiado, no hacemos nada y ocultamos el formulario
            if (newUsername === oldUsername) {
                alert('El nuevo nombre de usuario es el mismo que el actual.');
                hideEditForm();
                return;
            }

            try {
                // Realiza la solicitud PUT a tu endpoint de Flask
                const response = await fetch('/api/profile/update_username', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json' // Indica que el cuerpo es JSON
                    },
                    body: JSON.stringify({ new_username: newUsername }) // Convierte el objeto a cadena JSON
                });

                const result = await response.json(); // Parsea la respuesta JSON del servidor

                if (response.ok) { // Si la respuesta HTTP es exitosa (código 2xx)
                    currentUsernameSpan.textContent = result.new_username; // Actualiza el texto visible en la página
                    alert(result.message); // Muestra el mensaje de éxito
                    hideEditForm(); // Oculta el formulario de edición
                    // Recargar la página es importante para:
                    // 1. Asegurar que el username en la sesión de Flask (en el header, etc.) se actualice.
                    // 2. Mostrar cualquier mensaje flash que Flask haya enviado.
                    location.reload();
                } else { // Si la respuesta HTTP indica un error
                    alert('Error: ' + result.message); // Muestra el mensaje de error del servidor
                }
            } catch (error) {
                // Captura errores de red o cualquier otro error durante la solicitud fetch
                console.error('Error al actualizar el perfil:', error);
                alert('Error al conectar con el servidor para actualizar el perfil. Por favor, inténtalo de nuevo.');
            }
        });
    }
});