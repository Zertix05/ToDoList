import IMask from 'imask';
// --- Interfaces ---
interface Group {
    id: number;
    name: string;
}

interface Contact {
    id: number;
    name: string;
    phone: string;
    groupId: number;
}

// --- Global Variables (will be initialized inside DOMContentLoaded) ---
let groups: Group[] = [
    { id: 1, name: "Друзья" },
    { id: 2, name: "Коллеги" }
];

let contacts: Contact[] = [
    { id: 1, name: "Иван", phone: "+7 (900) 123-45-67", groupId: 1 },
    { id: 2, name: "Ольга", phone: "+7 (911) 765-43-21", groupId: 1 },
    { id: 3, name: "Босс", phone: "+7 (495) 000-00-00", groupId: 2 }
];

const LOCAL_STORAGE_GROUPS_KEY = 'contactAppGroups';
const LOCAL_STORAGE_CONTACTS_KEY = 'contactAppContacts';


let groupToDelete: number | null = null;
let contactToDelete: number | null = null; // For contact deletion confirmation
let selectedGroupId: number | null = null;
let editingContactId: number | null = null; // To track if we're editing a contact


// --- DOM Elements (will be initialized inside DOMContentLoaded) ---
let modal: HTMLElement;
let confirmBtn: HTMLButtonElement;
let cancelBtn: HTMLButtonElement;
let openbtn: HTMLButtonElement;
let closebtn: HTMLButtonElement;
let sidebar: HTMLElement;
let addButton: HTMLButtonElement;
let groupList: HTMLElement;
let openContactSidebarBtn: HTMLButtonElement;
let closeContactSidebarBtn: HTMLButtonElement;
let contactSidebar: HTMLElement;
let contactNameInput: HTMLInputElement;
let contactPhoneInput: HTMLInputElement;
let dropdownButton: HTMLButtonElement;
let dropdownList: HTMLUListElement;
let saveContactBtn: HTMLButtonElement;
let nameError: HTMLElement;
let phoneError: HTMLElement;
let saveGroupsBtn: HTMLButtonElement;
let contactGroupsContainer: HTMLElement; // New container for rendering contacts

// Инициализация IMask для телефона

contactPhoneInput = document.getElementById('contactPhone') as HTMLInputElement;
const phoneMask = IMask(contactPhoneInput, {
  mask: '+{7} (000) 000-00-00'
})
// --- Functions ---

function showToast(message: string, type: 'success' | 'error'): void {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    toast.style.color = 'white';
    toast.style.borderRadius = '6px';
    toast.style.zIndex = '2000';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function loadFromLocalStorage(): void {
  const savedGroups = localStorage.getItem(LOCAL_STORAGE_GROUPS_KEY);
  const savedContacts = localStorage.getItem(LOCAL_STORAGE_CONTACTS_KEY);

  if (savedGroups) {
    try {
      groups = JSON.parse(savedGroups);
    } catch (e) {
      console.error("Ошибка при разборе сохраненных групп", e);
    }
  }

  if (savedContacts) {
    try {
      contacts = JSON.parse(savedContacts);
    } catch (e) {
      console.error("Ошибка при разборе сохраненных контактов", e);
    }
  }
}

loadFromLocalStorage();

function saveToLocalStorage(): void {
  localStorage.setItem(LOCAL_STORAGE_GROUPS_KEY, JSON.stringify(groups));
  localStorage.setItem(LOCAL_STORAGE_CONTACTS_KEY, JSON.stringify(contacts));
}


function updateDropdown(): void {
    dropdownList.innerHTML = '';
    groups.forEach(group => {
        const li = document.createElement('li');
        li.textContent = group.name;
        li.className = 'sidebar_dropdown-item';
        li.addEventListener('click', () => {
            selectedGroupId = group.id;
            dropdownButton.textContent = group.name;
            dropdownList.classList.add('hidden');
        });
        dropdownList.appendChild(li);
    });
    // Set default dropdown text if no group is selected
    if (selectedGroupId === null) {
        dropdownButton.textContent = 'Выберите группу';
    } else {
        const selectedGroup = groups.find(g => g.id === selectedGroupId);
        if (selectedGroup) {
            dropdownButton.textContent = selectedGroup.name;
        } else {
            // If the selected group was deleted, reset
            selectedGroupId = null;
            dropdownButton.textContent = 'Выберите группу';
        }
    }
}

function getNextGroupId(): number {
    if (groups.length === 0) return 1;
    return Math.max(...groups.map(g => g.id)) + 1;
}

function createGroupElement(group: { id: number; name: string }): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'group-list_item';
    li.dataset.groupId = group.id.toString();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'group-list_input';
    input.placeholder = 'Введите название';
    input.value = group.name;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'group-list_delete';
    deleteBtn.innerHTML = '<img src="/src/img/delete.svg" alt="delete">';

    // Attach delete event listener directly to the created button
    deleteBtn.addEventListener('click', () => {
        const groupIdAttr = li.dataset.groupId;
        if (groupIdAttr) {
            groupToDelete = parseInt(groupIdAttr, 10);
            openModal(); // Open confirmation modal
        }
    });

    li.append(input, deleteBtn);
    return li;
}

function openModal(): void {
    modal.classList.remove('hidden');
}

function closeModal(): void {
    modal.classList.add('hidden');
    groupToDelete = null; 
    contactToDelete = null; 
}

function resetContactForm(): void {
    contactNameInput.value = '';
    contactPhoneInput.value = '';
    phoneMask.value = ''; // Ensure mask value is cleared
    selectedGroupId = null;
    editingContactId = null; // Reset editing state
    dropdownButton.textContent = 'Выберите группу';
    contactNameInput.classList.remove('error');
    contactPhoneInput.classList.remove('error');
    dropdownButton.classList.remove('error');
    nameError.classList.add('hidden');
    phoneError.classList.add('hidden');
}

// --- NEW/UPDATED renderContacts function ---
function renderContacts(): void {
    if (!contactGroupsContainer) {
        console.error("Contact groups container not found.");
        return;
    }

    contactGroupsContainer.innerHTML = ''; // Clear previous content

    if (contacts.length === 0 && groups.length === 0) {
        contactGroupsContainer.innerHTML = '<div class="main-content__empty">Список контактов пуст</div>';
        return;
    }

    // Group contacts by groupId
    const groupedContacts: { [key: number]: Contact[] } = {};
    contacts.forEach(contact => {
        if (!groupedContacts[contact.groupId]) {
            groupedContacts[contact.groupId] = [];
        }
        groupedContacts[contact.groupId].push(contact);
    });

    // Sort groups by ID or name if desired, before rendering
    const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name)); // Sort by name

    sortedGroups.forEach(group => {
        const groupElement = document.createElement('div');
        groupElement.className = 'contact-group';
        groupElement.dataset.groupId = group.id.toString(); // Add data-group-id for reference

        const header = document.createElement('div');
        header.className = 'contact-group_header';
        header.innerHTML = `
            <h3 class="contact-group_title">${group.name}</h3>
            <button class="contact-group_toggle">

            </button>
        `;
        groupElement.appendChild(header);

        const contactList = document.createElement('ul');
        contactList.className = 'contact-group_list';

        // Add event listener for toggling group visibility
        const toggleButton = header.querySelector('.contact-group_toggle') as HTMLButtonElement;
        toggleButton.addEventListener('click', () => {
            contactList.classList.toggle('collapsed');
            toggleButton.classList.toggle('open');
            header.classList.toggle('open');
        });

        const contactsInGroup = groupedContacts[group.id] || [];
        if (contactsInGroup.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className = 'contact-item';
            emptyLi.style.justifyContent = 'center';
            emptyLi.style.color = '#797979';
            emptyLi.textContent = 'Нет контактов в этой группе';
            contactList.appendChild(emptyLi);
        } else {
            contactsInGroup.forEach(contact => {
                const li = document.createElement('li');
                li.className = 'contact-item';
                li.dataset.contactId = contact.id.toString();
                li.dataset.groupId = contact.groupId.toString();

                li.innerHTML = `
                    <span class="contact-item_name">${contact.name}</span>
                    <span class="contact-item_details">
                    <span class="contact-item_phone">${contact.phone}</span>
                    <div class="contact-item_actions">
                        <button class="contact-item_button contact-item_button--edit">
                          <img src="src/img/edit.svg" alt="edit">
                        </button>
                        <button class="contact-item_button contact-item_button--delete">
                          <img src="src/img/delete.svg" alt="delete">
                        </button>
                    </div>
                    </span>
                `;

                // Add event listeners for edit and delete buttons on each contact
                const deleteContactBtn = li.querySelector('.contact-item_button--delete') as HTMLButtonElement;
                  deleteContactBtn.addEventListener('click', () => {
                      contactToDelete = contact.id;

                      const img = deleteContactBtn.querySelector('img') as HTMLImageElement;
                      const isActive = deleteContactBtn.classList.toggle('active');

                      if (isActive) {
                          img.src = 'src/img/delete-active.svg'; // путь к иконке активного состояния
                      } else {
                          img.src = 'src/img/delete.svg'; // вернуть стандартную иконку
                      }

                      openModal();
                  });


                const editContactBtn = li.querySelector('.contact-item_button--edit') as HTMLButtonElement;
                editContactBtn.addEventListener('click', () => {
                    editContact(contact.id);

                    const img = editContactBtn.querySelector('img') as HTMLImageElement;
                      const isActive = editContactBtn.classList.toggle('active');

                      if (isActive) {
                        img.src = 'src/img/edit-active.svg'; // иконка для активного состояния
                      } else {
                        img.src = 'src/img/edit.svg'; // вернуть стандартную иконку
                      }
                    });

                contactList.appendChild(li);
            });
        }

        groupElement.appendChild(contactList);
        contactGroupsContainer.appendChild(groupElement);
    });
    if (sortedGroups.length === 0 && contacts.length > 0) {
    }
}

// --- Contact Action Functions ---
function deleteContact(id: number): void {
    contacts = contacts.filter(c => c.id !== id);
    showToast("Контакт удален", "success");
    saveToLocalStorage();
    renderContacts(); // Re-render the list after deletion
}

function editContact(id: number): void {
    const contactToEdit = contacts.find(c => c.id === id);
    if (contactToEdit) {
        editingContactId = id; // Set the ID of the contact being edited

        contactNameInput.value = contactToEdit.name;
        phoneMask.value = contactToEdit.phone;
        selectedGroupId = contactToEdit.groupId;

        // Update dropdown button text with the selected group's name
        const groupName = groups.find(g => g.id === selectedGroupId)?.name;
        dropdownButton.textContent = groupName || 'Выберите группу';

        contactSidebar.classList.add('sidebar--visible');
    }
}


// --- Main DOMContentLoaded Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize DOM Elements ---
    modal = document.getElementById('confirmModal') as HTMLElement;
    confirmBtn = document.getElementById('confirmDelete') as HTMLButtonElement;
    cancelBtn = document.getElementById('cancelDelete') as HTMLButtonElement;
    openbtn = document.getElementById('openSidebar') as HTMLButtonElement;
    closebtn = document.getElementById('closeSideBar') as HTMLButtonElement;
    sidebar = document.getElementById('sidebar') as HTMLElement;
    addButton = document.querySelector('.sidebar_button--add') as HTMLButtonElement;
    groupList = document.querySelector('.group-list') as HTMLElement;
    openContactSidebarBtn = document.querySelector('.topbar_button--add') as HTMLButtonElement;
    closeContactSidebarBtn = document.getElementById('closeContactSidebar') as HTMLButtonElement;
    contactSidebar = document.getElementById('contactSidebar') as HTMLElement;
    contactNameInput = document.getElementById('contactName') as HTMLInputElement;
    
    dropdownButton = document.getElementById('dropdownButton') as HTMLButtonElement;
    dropdownList = document.getElementById('dropdownList') as HTMLUListElement;
    saveContactBtn = document.getElementById('saveContact') as HTMLButtonElement;
    nameError = document.getElementById('nameError') as HTMLElement;
    phoneError = document.getElementById('phoneError') as HTMLElement;
    saveGroupsBtn = document.querySelector('.sidebar_button--save') as HTMLButtonElement;
    contactGroupsContainer = document.getElementById('contactGroupsContainer') as HTMLElement; // Get the new container



    // --- Event Listeners ---

    // Group Sidebar Open/Close
    openbtn?.addEventListener('click', () => {
        sidebar?.classList.add('sidebar--visible');
    });

    closebtn?.addEventListener('click', () => {
        sidebar?.classList.remove('sidebar--visible');

        const img=closebtn.querySelector('img')as HTMLImageElement;
            const isActive = closebtn.classList.toggle('active');

            if (isActive) {
              img.src = 'src/img/close-active.svg';
            } else {
              img.src = 'src/img/close.svg';
            }
    });

    openContactSidebarBtn?.addEventListener('click', () => {
        resetContactForm();
        contactSidebar?.classList.add('sidebar--visible');
    });
    closeContactSidebarBtn?.addEventListener('click', () => {
        contactSidebar?.classList.remove('sidebar--visible');
        resetContactForm(); 
    });

    confirmBtn?.addEventListener('click', () => {
        if (groupToDelete !== null) {
            groups = groups.filter((g) => g.id !== groupToDelete);
            contacts = contacts.filter((c) => c.groupId !== groupToDelete);

            const groupElement = document.querySelector(`.group-list_item[data-group-id="${groupToDelete}"]`) as HTMLElement | null;
            if (groupElement) {
                groupElement.remove(); 
            }
            showToast("Группа и все контакты удалены", "success");

        } else if (contactToDelete !== null) {
            deleteContact(contactToDelete);
        }
        saveToLocalStorage();
        closeModal();
        renderContacts(); 
        updateDropdown();
    });

    cancelBtn?.addEventListener('click', () => {
        closeModal();
    });

    dropdownButton.addEventListener('click', () => {
        dropdownList.classList.toggle('hidden');
        dropdownButton.classList.toggle('open');
    });

    addButton.addEventListener('click', () => {
        const newId = getNextGroupId();
        const newGroup = { id: newId, name: '' };
        groups.push(newGroup);

        const newGroupElement = createGroupElement(newGroup);
        groupList.appendChild(newGroupElement); 
        newGroupElement.querySelector('input.group-list_input'); 

        updateDropdown();
    });

   saveGroupsBtn?.addEventListener('click', () => {
  const groupItems = document.querySelectorAll<HTMLLIElement>('.group-list_item');

  groupItems.forEach(item => {
    const input = item.querySelector('input.group-list_input') as HTMLInputElement;
    const groupIdAttr = item.dataset.groupId;

    if (!input || !groupIdAttr) return;

    const groupId = parseInt(groupIdAttr, 10);
    const groupName = input.value.trim();

    if (!groupName) return;

    const existingGroup = groups.find(g => g.id === groupId);

    if (existingGroup) {
      existingGroup.name = groupName;
    } else {
      groups.push({
        id: groupId,
        name: groupName
      });
    }
  });
  saveToLocalStorage();
  showToast("Группы успешно сохранены", "success");
  updateDropdown();
  renderContacts();
});

   saveContactBtn.addEventListener('click', () => {
    const name = contactNameInput.value.trim();
    const phone = phoneMask.unmaskedValue;

    let hasError = false;

    contactNameInput.classList.remove('error');
    contactPhoneInput.classList.remove('error');
    dropdownButton.classList.remove('error');
    nameError.classList.add('hidden');
    phoneError.classList.add('hidden');

    // Проверка обязательных полей
    if (!name) {
        contactNameInput.classList.add('error');
        nameError.classList.remove('hidden');
        hasError = true;
    }
    if (phone.length < 10) {
        contactPhoneInput.classList.add('error');
        phoneError.classList.remove('hidden');
        hasError = true;
    }
    if (selectedGroupId === null) {
        dropdownButton.classList.add('error');
        showToast("Пожалуйста, выберите группу", "error");
        hasError = true;
    }

    // Остановить сохранение, если есть ошибки валидации
    if (hasError) {
        showToast("Пожалуйста, заполните все обязательные поля и выберите группу", "error");
        return;
    }

    // Проверка на дублирующийся номер (кроме редактируемого контакта)
    const existingContactWithPhone = contacts.find(c => 
        c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '') && c.id !== editingContactId
    );
    if (existingContactWithPhone) {
        showToast(`Ошибка: контакт с номером ${phoneMask.value} уже существует`, "error");
        return;
    }

    // Сохранение контакта
    if (editingContactId !== null) {
        // Редактирование существующего контакта
        const contact = contacts.find(c => c.id === editingContactId);
        if (contact) {
            contact.name = name;
            contact.phone = phoneMask.value;
            contact.groupId = selectedGroupId as number;
            showToast(`Контакт "${name}" обновлен`, 'success');
        }
    } else {
        // Добавление нового контакта
        const newId = contacts.length > 0 ? Math.max(...contacts.map(c => c.id)) + 1 : 1;
        const newContact: Contact = {
            id: newId,
            name,
            phone: phoneMask.value,
            groupId: selectedGroupId as number
        };
        contacts.push(newContact);
        showToast(`Контакт "${name}" добавлен`, 'success');
    }

    saveToLocalStorage();
    resetContactForm();
    contactSidebar.classList.remove('sidebar--visible');
    renderContacts();
});



    updateDropdown(); 
    renderContacts();


    document.querySelectorAll<HTMLButtonElement>('.group-list_delete').forEach((btn) => {
        btn.addEventListener('click', () => {
            const groupItem = btn.closest('.group-list_item') as HTMLElement | null;
            if (groupItem) {
                const groupIdAttr = groupItem.dataset.groupId;
                if (groupIdAttr) {
                    groupToDelete = parseInt(groupIdAttr, 10);
                    openModal();
                }
            }
        });
    });

    const modalCloseBtn = document.getElementById('modal-close') as HTMLButtonElement;
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
});