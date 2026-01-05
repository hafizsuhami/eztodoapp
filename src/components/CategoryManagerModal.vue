<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { CategoryOption, Task } from '../types';
import { PASTEL_COLORS } from '../constants';
import ConfirmModal from './ConfirmModal.vue';

const props = defineProps<{
  isOpen: boolean;
  categories: CategoryOption[];
  tasks: Task[];
}>();

const emit = defineEmits<{
  close: [];
  updateCategory: [id: string, updates: { name?: string; color?: string }];
  createCategory: [name: string, color: string];
  deleteCategory: [id: string];
}>();

const editingId = ref<string | null>(null);
const editName = ref('');
const editColor = ref('');

const newCategoryName = ref('');
const newCategoryColor = ref(PASTEL_COLORS[0]);

// Delete confirmation state
const showDeleteConfirm = ref(false);
const categoryToDelete = ref<CategoryOption | null>(null);

watch(() => props.isOpen, (open) => {
  if (open) {
    editingId.value = null;
    editName.value = '';
    editColor.value = '';
    newCategoryName.value = '';
    newCategoryColor.value = PASTEL_COLORS[0];
    showDeleteConfirm.value = false;
    categoryToDelete.value = null;
  }
});

// Check if category can be deleted:
// - No tasks using it, OR all tasks using it are completed
const canDeleteCategory = (catId: string): boolean => {
  const tasksUsingCategory = props.tasks.filter(t => t.category === catId);
  if (tasksUsingCategory.length === 0) return true;
  return tasksUsingCategory.every(t => t.is_completed);
};

// Get delete status info for tooltip
const getDeleteInfo = (catId: string): { canDelete: boolean; reason: string } => {
  const tasksUsingCategory = props.tasks.filter(t => t.category === catId);
  if (tasksUsingCategory.length === 0) {
    return { canDelete: true, reason: 'No tasks in this category' };
  }
  const activeTasks = tasksUsingCategory.filter(t => !t.is_completed);
  if (activeTasks.length === 0) {
    return { canDelete: true, reason: `${tasksUsingCategory.length} completed task(s) will lose category` };
  }
  return { canDelete: false, reason: `${activeTasks.length} active task(s) using this category` };
};

const startEditing = (cat: CategoryOption) => {
  editingId.value = cat.id;
  editName.value = cat.name;
  editColor.value = cat.color;
};

const saveEdit = () => {
  if (editingId.value && editName.value.trim()) {
    emit('updateCategory', editingId.value, { name: editName.value.trim(), color: editColor.value });
    editingId.value = null;
  }
};

const cancelEdit = () => {
  editingId.value = null;
};

const handleCreate = () => {
  if (newCategoryName.value.trim()) {
    emit('createCategory', newCategoryName.value.trim(), newCategoryColor.value);
    newCategoryName.value = '';
    newCategoryColor.value = PASTEL_COLORS[0];
  }
};

const handleDeleteClick = (cat: CategoryOption) => {
  categoryToDelete.value = cat;
  showDeleteConfirm.value = true;
};

const handleConfirmDelete = () => {
  if (categoryToDelete.value) {
    emit('deleteCategory', categoryToDelete.value.id);
  }
  showDeleteConfirm.value = false;
  categoryToDelete.value = null;
};

const deleteConfirmMessage = computed(() => {
  if (!categoryToDelete.value) return '';
  const info = getDeleteInfo(categoryToDelete.value.id);
  const tasksUsingCategory = props.tasks.filter(t => t.category === categoryToDelete.value!.id);
  if (tasksUsingCategory.length === 0) {
    return `Are you sure you want to delete the "${categoryToDelete.value.name}" category?`;
  }
  return `Are you sure you want to delete the "${categoryToDelete.value.name}" category? ${tasksUsingCategory.length} completed task(s) will lose their category assignment.`;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity"
    >
      <div class="bg-white dark:bg-[#1e293b] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all scale-100 pb-safe sm:pb-0">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">Manage Categories</h3>
          <button 
            @click="emit('close')"
            class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="px-4 py-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          <!-- Existing Categories -->
          <div class="flex flex-col gap-2">
            <div
              v-for="cat in categories"
              :key="cat.id"
              class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#161f30] rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <template v-if="editingId === cat.id">
                <div class="flex flex-col gap-2 w-full">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="editName"
                      type="text"
                      class="flex-1 bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                      @keyup.enter="saveEdit"
                    />
                    <button
                      @click="saveEdit"
                      class="text-primary hover:text-primary/80 shrink-0"
                    >
                      <span class="material-symbols-outlined text-[20px]">check</span>
                    </button>
                    <button
                      @click="cancelEdit"
                      class="text-slate-400 hover:text-slate-600 shrink-0"
                    >
                      <span class="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="col in PASTEL_COLORS"
                      :key="col"
                      @click="editColor = col"
                      class="w-5 h-5 rounded-full border-2 transition-all"
                      :style="{ backgroundColor: col }"
                      :class="editColor === col ? 'border-primary scale-110' : 'border-transparent'"
                    ></button>
                  </div>
                </div>
              </template>
              <template v-else>
                <span
                  class="w-4 h-4 rounded-full shrink-0"
                  :style="{ backgroundColor: cat.color }"
                ></span>
                <span class="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{{ cat.name }}</span>
                <button
                  @click="startEditing(cat)"
                  class="text-slate-400 hover:text-primary transition-colors"
                  title="Edit"
                >
                  <span class="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button
                  v-if="canDeleteCategory(cat.id)"
                  @click="handleDeleteClick(cat)"
                  class="text-slate-400 hover:text-red-500 transition-colors"
                  :title="getDeleteInfo(cat.id).reason"
                >
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
                <span
                  v-else
                  class="text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  :title="getDeleteInfo(cat.id).reason"
                >
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </span>
              </template>
            </div>
          </div>

          <!-- Add New Category -->
          <div class="border-t border-slate-200 dark:border-slate-700 pt-4">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Add New Category</p>
            <div class="flex flex-col gap-3">
              <input
                v-model="newCategoryName"
                type="text"
                placeholder="Category name..."
                class="w-full bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              />
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="col in PASTEL_COLORS"
                  :key="col"
                  @click="newCategoryColor = col"
                  class="w-6 h-6 rounded-full border-2 transition-all"
                  :style="{ backgroundColor: col }"
                  :class="newCategoryColor === col ? 'border-primary scale-110' : 'border-transparent'"
                ></button>
              </div>
              <button
                @click="handleCreate"
                :disabled="!newCategoryName.trim()"
                class="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :is-open="showDeleteConfirm"
      title="Delete Category"
      :message="deleteConfirmMessage"
      confirm-text="Confirm"
      cancel-text="Cancel"
      variant="danger"
      icon="delete"
      @confirm="handleConfirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </Teleport>
</template>
