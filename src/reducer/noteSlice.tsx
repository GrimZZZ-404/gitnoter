import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { deleteNote, getAllNotes, getNote, getNotesTree, saveNote, searchNotes } from "../api/api";
import { RootState } from "../app/store";
import TreeUtil from "../util/TreeUtil";
import { APIStatus, APIStatusType } from "./common";

export interface SearchParams {
  page?: number
  path?: string
  query?: string
}

export interface TreeNode {
  name: string
  sha?: string
  path: string
  content?: string
  size?: number
  is_dir: boolean
  cached: boolean
  children?: TreeNode[]
}

export interface NoteResponsePayload {
  sha: string
  path: string
  content: string
  size: number
  is_dir: boolean
}

export interface NotePage {
  total: number
  notes: NoteResponsePayload[]
}

interface NoteState {
  page: NotePage
  tree: TreeNode
  current: NoteResponsePayload | null
  status: APIStatus
}

const initialState: NoteState = {
  page: {
    total: 1,
    notes: []
  },
  tree: {
    name: "root",
    path: "",
    cached: false,
    is_dir: true
  },
  current: null,
  status: {
    searchNotesAsync: APIStatusType.IDLE,
    getNotesTreeAsync: APIStatusType.IDLE,
    getNotesAsync: APIStatusType.IDLE,
    getNoteAsync: APIStatusType.IDLE,
    saveNoteAsync: APIStatusType.IDLE,
    deleteNoteAsync: APIStatusType.IDLE,
  }
}

export const searchNotesAsync = createAsyncThunk(
  'note/searchNotes',
  async (params?: SearchParams) => {
    const response = await searchNotes(params?.page, params?.path, params?.query);
    return response;
  }
);

export const getNotesTreeAsync = createAsyncThunk(
  'note/fetchNotesTree',
  async () => {
    const response = await getNotesTree() as NoteResponsePayload[];
    return response;
  }
);

export const getNotesAsync = createAsyncThunk(
  'note/fetchNotes',
  async (path: string) => {
    const response = await getAllNotes(path) as NoteResponsePayload[];
    return response;
  }, {
  condition: (path, { getState }) => {
    const state = getState() as RootState;
    const node = TreeUtil.searchNode(state.notes.tree, path);
    const hasFiles = !!(node?.children && node.children.find(o => !o.is_dir));
    return !node?.cached && hasFiles;
  }
}
);

export const getNoteAsync = createAsyncThunk(
  'note/fetchNote',
  async (path: string) => {
    const response = await getNote(path) as NoteResponsePayload;
    return response;
  }, {
  condition: (path, { getState }) => {
    const state = getState() as RootState;
    const node = TreeUtil.searchNode(state.notes.tree, path);
    return !node?.cached;
  }
}
);

export const saveNoteAsync = createAsyncThunk(
  'note/saveNote',
  async ({ path, content, sha }: { path: string, content: string, sha?: string }) => {
    const response = await saveNote(path, content, sha) as NoteResponsePayload;
    return {
      ...response,
      content: content
    };
  }
);

export const deleteNoteAsync = createAsyncThunk(
  'note/deleteNote',
  async (note: TreeNode) => {
    await deleteNote(note.path, note.sha);
    return note;
  }
);

export const noteSlice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    resetStatus: (state) => { state.status = initialState.status; }
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchNotesAsync.pending, (state) => {
        state.status.searchNotesAsync = APIStatusType.LOADING;
      })
      .addCase(searchNotesAsync.fulfilled, (state, action) => {
        state.page = action.payload as NotePage;
        const tree = TreeUtil.parse(state.tree, state.page.notes, true);
        state.tree = tree;
        state.status.searchNotesAsync = APIStatusType.IDLE;
      })
      .addCase(searchNotesAsync.rejected, (state) => {
        state.page = initialState.page;
        state.status.searchNotesAsync = APIStatusType.FAIL;
      })

      .addCase(getNotesTreeAsync.pending, (state) => {
        state.status.getNotesTreeAsync = APIStatusType.LOADING;
      })
      .addCase(getNotesTreeAsync.fulfilled, (state, action) => {
        state.page.notes = action.payload;
        const tree = TreeUtil.parse(initialState.tree, state.page.notes, false);
        state.tree = tree;
        state.status.getNotesTreeAsync = APIStatusType.IDLE;
      })
      .addCase(getNotesTreeAsync.rejected, (state) => {
        state.page.notes = initialState.page.notes;
        state.status.getNotesTreeAsync = APIStatusType.FAIL;
      })

      .addCase(getNotesAsync.pending, (state) => {
        state.status.getNotesAsync = APIStatusType.LOADING;
      })
      .addCase(getNotesAsync.fulfilled, (state, action) => {
        state.page.notes = action.payload;
        const tree = TreeUtil.parse(state.tree, state.page.notes, true);
        state.tree = tree;
        state.status.getNotesAsync = APIStatusType.IDLE;
      })
      .addCase(getNotesAsync.rejected, (state) => {
        state.page.notes = initialState.page.notes;
        state.status.getNotesAsync = APIStatusType.FAIL;
      })

      .addCase(getNoteAsync.pending, (state) => {
        state.current = null
        state.status.getNoteAsync = APIStatusType.LOADING;
      })
      .addCase(getNoteAsync.fulfilled, (state, action) => {
        state.current = action.payload;
        const tree = TreeUtil.parse(state.tree, [action.payload]);
        state.tree = tree;
        state.status.getNoteAsync = APIStatusType.IDLE;
      })
      .addCase(getNoteAsync.rejected, (state) => {
        state.status.getNoteAsync = APIStatusType.FAIL;
      })

      .addCase(saveNoteAsync.pending, (state) => {
        state.status.saveNoteAsync = APIStatusType.LOADING;
      })
      .addCase(saveNoteAsync.fulfilled, (state, action) => {
        state.page.notes = state.page.notes.filter(n => n.sha !== action.payload.sha)
        state.page.notes.push(action.payload)
        const tree = TreeUtil.parse(state.tree, [action.payload]);
        state.tree = tree;
        state.status.saveNoteAsync = APIStatusType.IDLE;
      })
      .addCase(saveNoteAsync.rejected, (state) => {
        state.status.saveNoteAsync = APIStatusType.FAIL;
      })

      .addCase(deleteNoteAsync.pending, (state) => {
        state.status.deleteNoteAsync = APIStatusType.LOADING;
      })
      .addCase(deleteNoteAsync.fulfilled, (state, action) => {
        state.page.notes = state.page.notes.filter(n => n.path !== action.payload.path)
        TreeUtil.deleteNode(state.tree, action.payload.path)
        state.status.deleteNoteAsync = APIStatusType.IDLE;
      })
      .addCase(deleteNoteAsync.rejected, (state) => {
        state.status.deleteNoteAsync = APIStatusType.FAIL;
      });
  },
})

export const { resetStatus } = noteSlice.actions;
export const selectCurrentNote = (state: RootState): NoteResponsePayload | null => state.notes.current;
export const selectNotesPage = (state: RootState): NotePage => state.notes.page;
export const selectNotesTree = (state: RootState): TreeNode => state.notes.tree;
export const selectNoteAPIStatus = (state: RootState): APIStatus => state.notes.status;
export default noteSlice.reducer;
