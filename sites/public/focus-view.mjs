const STORAGE_PREFIX = 'mint-goals-focus-v1:';
const FIELDS = ['enabled', 'focusedId', 'otherOpen', 'completedOpen', 'order'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => typeof value === 'string' && value.trim().length > 0;
const isScope = value => value === '' || isId(value);
const isOrder = value => Array.isArray(value) && value.length <= 200 && value.every(isId) && new Set(value).size === value.length;
const defaults = () => ({ enabled: false, focusedId: null, otherOpen: false, completedOpen: false, order: [] });

function validField(key, value) {
  if (key === 'focusedId') return value === null || isId(value);
  if (key === 'order') return isOrder(value);
  return typeof value === 'boolean';
}

function cleanPreference(value) {
  const preference = defaults();
  if (!isRecord(value)) return preference;
  for (const key of FIELDS) {
    if (Object.hasOwn(value, key) && validField(key, value[key])) {
      preference[key] = key === 'order' ? [...value[key]] : value[key];
    }
  }
  return preference;
}

/** Browser-only preferences. These values never belong in a notebook backup. */
export function createFocusPreferences(storage, ownerScope) {
  const scopes = new Map();
  let category = '';
  const key = typeof ownerScope === 'string' && ownerScope.trim() && ownerScope.length <= 256
    ? `${STORAGE_PREFIX}${ownerScope}` : null;
  let canPersist = Boolean(key);
  let saved = null;
  if (canPersist) {
    try {
      saved = storage.getItem(key);
    } catch {
      canPersist = false;
    }
  }
  if (typeof saved === 'string') {
    try {
      const data = JSON.parse(saved);
      if (isRecord(data)) {
        if (Object.hasOwn(data, 'category') && isScope(data.category)) category = data.category;
        if (Object.hasOwn(data, 'scopes') && isRecord(data.scopes)) {
          for (const [scope, preference] of Object.entries(data.scopes)) {
            if (isScope(scope)) scopes.set(scope, cleanPreference(preference));
          }
        }
      }
    } catch {
      // A damaged saved preference can be replaced by the next explicit change.
    }
  }

  function persist() {
    if (!canPersist) return false;
    try {
      storage.setItem(key, JSON.stringify({ category, scopes: Object.fromEntries(scopes) }));
      return true;
    } catch {
      // Keep this tab usable when browser storage is blocked or full.
      return false;
    }
  }

  return {
    get(scope) {
      return cleanPreference(isScope(scope) ? scopes.get(scope) : null);
    },
    patch(scope, change) {
      if (!isScope(scope) || !isRecord(change)) return false;
      const entries = Object.entries(change);
      if (entries.some(([field, value]) => !FIELDS.includes(field) || !validField(field, value))) return false;
      const preference = cleanPreference(scopes.get(scope));
      for (const [field, value] of entries) preference[field] = field === 'order' ? [...value] : value;
      scopes.set(scope, preference);
      return persist();
    },
    getCategory() {
      return category;
    },
    setCategory(value) {
      if (!isScope(value)) return false;
      category = value;
      return persist();
    },
  };
}

export function goalsInScope(goals, category = '') {
  if (!Array.isArray(goals) || !isScope(category)) return [];
  return goals.filter(goal => isRecord(goal) && (!category || (category === 'uncategorized' ? !goal.categoryId : goal.categoryId === category)));
}

/** Saved priorities come first; newly added and unranked goals keep their order. */
export function orderedGoals(goals, order = []) {
  const ranks = new Map((isOrder(order) ? order : []).map((id, index) => [id, index]));
  return [...goals].sort((a, b) => (ranks.get(a.id) ?? ranks.size) - (ranks.get(b.id) ?? ranks.size));
}

export function focusSelection(goals, category, preference) {
  const scoped = goalsInScope(goals, category);
  const current = cleanPreference(preference);
  const active = orderedGoals(scoped.filter(goal => goal.status === 'active'), current.order);
  const focused = current.focusedId === null ? null : scoped.find(goal => goal.id === current.focusedId) ?? null;
  const others = active.filter(goal => goal.id !== current.focusedId);
  return {
    active,
    others,
    completed: scoped.filter(goal => goal.status === 'completed'),
    focused,
    next: others[0] ?? null,
  };
}
