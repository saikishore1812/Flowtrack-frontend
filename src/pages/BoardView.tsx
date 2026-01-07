import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../api/api";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import socket from "../utils/socket";
import { isManager } from "../utils/rbac";

interface SubTask {
  ID: number;
  title: string;
  done: boolean;
}

interface Task {
  ID: number;
  title: string;
  description: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
  due_date?: string;
  labels?: string[];
}

interface List {
  ID: number;
  title: string;
  tasks?: Task[];
}
interface SavedFilter {
  id: number;
  name: string;
  status?: string;
  priority?: string;
  assignee?: string;
  label?: string;
  search?: string;
  is_pinned?: boolean;
}

// ---------- LABEL COLOR HELPER ----------
const getLabelColor = (label: string) => {
  const map: Record<string, string> = {
    bug: "#ff4d4d",
    ui: "#8e44ad",
    backend: "#3498db",
    feature: "#2ecc71",
    urgent: "#e67e22"
  };

  return map[label.toLowerCase()] || "#95a5a6";
};
// 🟢 REPLACE YOUR UserAvatar FUNCTION WITH THIS:
const UserAvatar = ({ name }: { name: string }) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : "??";
  return (
    <div 
      title={name}  // 👈 MOVED HERE (Outside style)
      style={{
        width: "24px", height: "24px", borderRadius: "50%",
        background: "#6366f1", color: "white",
        fontSize: "10px", display: "flex", alignItems: "center", 
        justifyContent: "center", fontWeight: "bold"
      }}
    >
      {initials}
    </div>
  );
};

const BoardView = () => {
  const { id } = useParams();
  

  const [lists, setLists] = useState<List[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [title, setTitle] = useState("");

  // Add Task Modal
  const [activeList, setActiveList] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssign, setTaskAssign] = useState("");
  const [taskDue, setTaskDue] = useState("");

  // Selected Task
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Panels
  const [taskActivity, setTaskActivity] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");

  // Edit Panel
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("todo");
  const [editPriority, setEditPriority] = useState("normal");
  const [editAssigned, setEditAssigned] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editLabels, setEditLabels] = useState("");
  // ---------------- FILTERS ----------------
const [filterLabel, setFilterLabel] = useState("");
const [filterPriority, setFilterPriority] = useState("");
const [filterStatus, setFilterStatus] = useState("");
const [filterAssignee, setFilterAssignee] = useState("");
const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
const [showSaveFilter, setShowSaveFilter] = useState(false);
const [filterName, setFilterName] = useState("");
// ---------------- SAVED FILTERS ----------------
const loadSavedFilters = async () => {
  const res = await api.get("/filters", {
    params: { board_id: id }
  });

  setSavedFilters(res.data);

  // ⭐ STEP 8 — AUTO APPLY PINNED FILTER
  const pinned = res.data.find((f: any) => f.is_pinned);
  if (pinned) {
    setFilterStatus(pinned.status || "");
    setFilterPriority(pinned.priority || "");
    setFilterAssignee(pinned.assignee || "");
    setFilterLabel(pinned.label || "");
    setSearchText(pinned.search || "");
  }
};


const saveCurrentFilter = async () => {
  if (!filterName.trim()) return;

  await api.post("/filters", {
    name: filterName,
    board_id: Number(id),
    status: filterStatus,
    priority: filterPriority,
    assignee: filterAssignee,
    label: filterLabel,
    search: searchText
  });

  setFilterName("");
  setShowSaveFilter(false);
  // ---------------- PIN FILTER ----------------


  loadSavedFilters();
};
const pinFilter = async (id: number) => {
  await api.put(`/filters/pin/${id}`);
  loadSavedFilters();
};

const applySavedFilter = (filter: SavedFilter) => {
  setFilterStatus(filter.status || "");
  setFilterPriority(filter.priority || "");
  setFilterAssignee(filter.assignee || "");
  setFilterLabel(filter.label || "");
  setSearchText(filter.search || "");
};

// ---------------- SEARCH ----------------
const [searchText, setSearchText] = useState("");


  // Subtasks
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [newSubTask, setNewSubTask] = useState("");

  const startAddTask = (listId: number) => setActiveList(listId);

  // ---------------- CREATE LIST ----------------
  const createList = async () => {
    if (!title.trim()) return;

    await api.post("/lists", {
      title,
      board_id: Number(id)
    });

    setTitle("");
    setShowInput(false);
    getLists();
  };
  

  // ---------------- CREATE TASK ----------------
  const createTask = async () => {
    if (!taskTitle.trim() || !activeList) return;

    const formattedDate = taskDue ? new Date(taskDue).toISOString() : null;

    await api.post("/tasks", {
      title: taskTitle,
      description: taskDesc,
      list_id: activeList,
      status: "todo",
      priority: "normal",
      assigned_to: taskAssign,
      due_date: formattedDate,
      labels: []
    });

    setTaskTitle("");
    setTaskDesc("");
    setTaskAssign("");
    setTaskDue("");
    setActiveList(null);
    getLists();
  };

  // ---------------- LOAD LISTS ----------------
  const getLists = useCallback(async () => {
    const res = await api.get(`/lists/${id}`);
    const listsData = res.data;

    const finalLists = await Promise.all(
      listsData.map(async (list: any) => {
        const tasksRes = await api.get(`/tasks/${list.ID}`);
        return { ...list, tasks: tasksRes.data };
      })
    );

    setLists(finalLists);
  }, [id]);

  useEffect(() => {
    getLists();
    loadSavedFilters();
    const handleSocket = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);

      if (
        msg.type === "task_created" ||
        msg.type === "task_updated" ||
        msg.type === "task_deleted" ||
        msg.type === "task_moved"
      ) {
        getLists();
      }
    };

    socket.addEventListener("message", handleSocket);

    return () => socket.removeEventListener("message", handleSocket);
  }, [id, getLists]);

  // ---------------- DRAG ----------------
  const handleDrag = async (result: any) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    await api.put("/tasks/move", {
      task_id: Number(draggableId),
      source_list_id: Number(source.droppableId),
      target_list_id: Number(destination.droppableId),
      new_position: destination.index
    });

    getLists();
  };

  // ---------------- PANELS ----------------
  const loadActivity = async (taskId: number) => {
    const res = await api.get(`/activity/${taskId}`);
    setTaskActivity(res.data);
  };

  const loadComments = async (taskId: number) => {
    const res = await api.get(`/comments/${taskId}`);
    setComments(res.data);
  };

  const addComment = async () => {
    if (!commentText.trim() || !selectedTask) return;

    await api.post("/comments", {
      task_id: selectedTask.ID,
      user: "User",
      message: commentText
    });

    setCommentText("");
    loadComments(selectedTask.ID);
  };

  const loadSubTasks = async (taskId: number) => {
    const res = await api.get(`/subtasks/${taskId}`);
    setSubTasks(res.data);
  };

  // ---------------- UPDATE TASK ----------------
  const updateTask = async () => {
    if (!selectedTask) return;

    const formattedDate = editDueDate
      ? new Date(editDueDate).toISOString()
      : null;

    await api.put(`/tasks/${selectedTask.ID}`, {
      title: editTitle,
      description: editDesc,
      status: editStatus,
      priority: editPriority,
      assigned_to: editAssigned,
      due_date: formattedDate,
      labels: editLabels
        .split(",")
        .map(l => l.trim())
        .filter(l => l !== "")
    });

    setEditMode(false);
    setSelectedTask(null);
    getLists();
  };

  // ---------------- DELETE TASK ----------------
  const deleteTask = async () => {
    if (!selectedTask) return;

    await api.delete(`/tasks/${selectedTask.ID}`);
    setSelectedTask(null);
    getLists();
  };

  // ---------------- DUE ----------------
  const getDueStatus = (date?: string) => {
    if (!date) return { text: "No Due Date", color: "#999" };

    const today = new Date();
    const due = new Date(date);
    const diff = Math.ceil(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff < 0) return { text: "Overdue", color: "#ff4d4d" };
    if (diff === 0) return { text: "Due Today", color: "#ffcc00" };
    if (diff <= 3) return { text: "Due Soon", color: "#ff9933" };

    return { text: due.toISOString().slice(0, 10), color: "#4CAF50" };
  };
 const applyFilters = (tasks: Task[]) => {
  return tasks.filter(task => {
    if (
      searchText &&
      !task.title.toLowerCase().includes(searchText.toLowerCase()) &&
      !task.description?.toLowerCase().includes(searchText.toLowerCase())
    ) {
      return false;
    }

    if (filterLabel && !task.labels?.includes(filterLabel)) return false;
    if (filterPriority && task.priority !== filterPriority) return false;
    if (filterStatus && task.status !== filterStatus) return false;
    if (filterAssignee && task.assigned_to !== filterAssignee) return false;

    return true;
  });
};



  // ---------------- OPEN TASK ----------------
  const openTask = (task: Task) => {
    setSelectedTask(task);
    setEditMode(false);
    loadActivity(task.ID);
    loadComments(task.ID);
    loadSubTasks(task.ID);
  };
  // ---------- LABEL COLOR ----------
const getLabelColor = (label: string) => {
  const colors: Record<string, string> = {
    bug: "#e74c3c",
    ui: "#9b59b6",
    backend: "#3498db",
    feature: "#2ecc71",
    urgent: "#e67e22",
    improvement: "#1abc9c"
  };

  return colors[label.toLowerCase()] || "#7f8c8d";
};

// ---------- SUBTASK PROGRESS ----------
const getSubtaskProgress = (subtasks?: SubTask[]) => {
  if (!subtasks || subtasks.length === 0) return 0;
  const done = subtasks.filter(s => s.done).length;
  return Math.round((done / subtasks.length) * 100);
};
const formatActivity = (log: any) => {
  switch (log.action) {
    case "CREATED_TASK":
      return "created the task";
    case "UPDATED_TASK":
      return "updated task details";
    case "STATUS_CHANGE":
      return "changed task status";
    case "ADD_COMMENT":
      return "added a comment";
    case "DELETE_TASK":
      return "deleted the task";
    default:
      return log.action.replace("_", " ").toLowerCase();
  }
};
const activityIcon = (action: string) => {
  if (action.includes("CREATE")) return "🟢";
  if (action.includes("UPDATE")) return "🟡";
  if (action.includes("DELETE")) return "🔴";
  if (action.includes("COMMENT")) return "💬";
  if (action.includes("STATUS")) return "🔄";
  return "📌";
};
const timeAgo = (date: string) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hrs ago`;
  return `${Math.floor(diff / 1440)} days ago`;
};

const deleteSavedFilter = async (id: number) => {
  await api.delete(`/filters/${id}`);
  loadSavedFilters();
};

  return (
    <div className="board-bg">
      <div className="container-fluid py-3">
        <div className="d-flex align-items-center justify-content-between mb-4 px-3">
  <div>
    <h3 className="fw-bold m-0" style={{color: "var(--text-primary)"}}>Board Workspace</h3>
    <p className="text-muted small m-0">Manage your project tasks and sprints</p>
  </div>
</div>
{/* ===== SAVED FILTERS PANEL ===== */}
{/* ===== SAVED FILTERS CHIPS ===== */}
{savedFilters.length > 0 && (
  <div className="px-3 mb-3">
    <div className="d-flex align-items-center gap-2 mb-2">
      <span className="small text-muted fw-bold text-uppercase">Saved Filters:</span>
    </div>
    
    <div className="d-flex flex-wrap gap-2">
      {savedFilters.map(filter => (
        <div 
          key={filter.id}
          className="d-flex align-items-center bg-white border shadow-sm rounded-pill px-3 py-1"
          style={{ transition: 'all 0.2s', cursor: 'pointer' }}
        >
          {/* Pinned Icon */}
          <span 
             onClick={(e) => { e.stopPropagation(); pinFilter(filter.id); }}
             className="me-2"
             style={{ cursor: "pointer", opacity: filter.is_pinned ? 1 : 0.3 }}
          >
            ⭐
          </span>

          {/* Filter Name */}
          <span className="fw-medium text-dark me-2" onClick={() => applySavedFilter(filter)} style={{fontSize: "13px"}}>
            {filter.name}
          </span>

          {/* Delete Icon */}
          <span 
             onClick={(e) => { e.stopPropagation(); deleteSavedFilter(filter.id); }}
             className="text-danger opacity-50 hover-opacity-100"
             style={{ cursor: "pointer", fontSize: "14px", marginLeft: "4px" }}
             title="Delete Filter"
          >
            ✕
          </span>
        </div>
      ))}
    </div>
  </div>
)}

        {/* ---------------- FILTER BAR ---------------- */}
 

<button
  className="btn btn-sm btn-outline-primary"
  onClick={() => setShowSaveFilter(true)}
>
  Save Filter
</button>

<div className="bg-white rounded-3 p-3 mb-4 mx-3 shadow-sm border border-light d-flex flex-wrap gap-3 align-items-center">

  <select className="form-select form-select-sm w-auto"
    value={filterStatus}
    onChange={(e) => setFilterStatus(e.target.value)}>
    <option value="">All Status</option>
    <option value="todo">Todo</option>
    <option value="progress">In Progress</option>
    <option value="done">Done</option>
  </select>

  <select className="form-select form-select-sm w-auto"
    value={filterPriority}
    onChange={(e) => setFilterPriority(e.target.value)}>
    <option value="">All Priority</option>
    <option value="low">Low</option>
    <option value="normal">Normal</option>
    <option value="high">High</option>
  </select>

  <select className="form-select form-select-sm w-auto"
    value={filterAssignee}
    onChange={(e) => setFilterAssignee(e.target.value)}>
    <option value="">All Assignees</option>
    <option value="Manager">Manager</option>
    <option value="Developer">Developer</option>
    <option value="QA">QA</option>
    <option value="Team Lead">Team Lead</option>
  </select>
  <input
  className="form-control form-control-sm w-25"
  placeholder="🔍 Search tasks..."
  value={searchText}
  onChange={(e) => setSearchText(e.target.value)}
/>


  <input
    className="form-control form-control-sm w-auto"
    placeholder="Filter Label"
    value={filterLabel}
    onChange={(e) => setFilterLabel(e.target.value)}
  />

  <button
    className="btn btn-sm btn-outline-secondary"
    onClick={() => {
      setFilterLabel("");
      setFilterPriority("");
      setFilterStatus("");
      setFilterAssignee("");
    }}
  >
    Clear
  </button>
</div>
{showSaveFilter && (
  <div className="task-panel-backdrop" onClick={() => setShowSaveFilter(false)}>
    <motion.div
      className="task-panel"
      onClick={(e) => e.stopPropagation()}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <h5>Save Filter</h5>

      <input
        className="form-control my-2"
        placeholder="Filter name"
        value={filterName}
        onChange={(e) => setFilterName(e.target.value)}
      />

      <div className="d-flex justify-content-end gap-2">
        <button
          className="btn btn-secondary"
          onClick={() => setShowSaveFilter(false)}
        >
          Cancel
        </button>
        <button className="btn btn-success" onClick={saveCurrentFilter}>
          Save
        </button>
      </div>
    </motion.div>
  </div>
)}


        <DragDropContext onDragEnd={handleDrag}>
          <div className="d-flex gap-3 mt-4 board-scroll">
            {lists.map((list) => (
              <Droppable droppableId={String(list.ID)} key={list.ID}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    <motion.div className="board-list" whileHover={{ scale: 1.02 }}>
                      <h5 className="fw-semibold mb-3">{list.title}</h5>

                      <div className="task-container">
                        {applyFilters(list.tasks || []).map((task, index) => (
                          <Draggable
                            draggableId={String(task.ID)}
                            index={index}
                            key={task.ID}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                               <motion.div
  className="task-card"
  whileHover={{ scale: 1.02 }}
  onClick={() => openTask(task)}
>
  {/* HEADER: Title */}
  <div className="d-flex justify-content-between align-items-start mb-2">
    <span style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
      {task.title}
    </span>
  </div>

  {/* TAGS ROW */}
  <div className="d-flex gap-1 flex-wrap mb-2">
    {/* Priority Badge */}
    <span className={`badge-pill priority-${task.priority}`}>
      {task.priority || "normal"}
    </span>
    {/* Custom Labels */}
    {task.labels?.map((label, i) => (
      <span key={i} className="badge-pill" style={{
        background: "#f3f4f6", color: "#4b5563", border: "1px solid #e5e7eb"
      }}>
        {label}
      </span>
    ))}
  </div>

  {/* FOOTER: Due Date & Assignee */}
  <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top"/>
    {/* Left: Due Date */}
    <div className="d-flex align-items-center gap-1 text-muted" style={{fontSize: "11px"}}>
       {task.due_date ? (
  <span
    style={{
      fontSize: "11px",
      padding: "3px 8px",
      borderRadius: "6px",
      background: getDueStatus(task.due_date).color,
      color: "#fff",
      fontWeight: 500
    }}
  >
    {getDueStatus(task.due_date).text}
  </span>
) : (
  <span className="text-muted" style={{ fontSize: "11px" }}>
    No Due Date
  </span>
)}


    {/* Right: Assignee Avatar */}
    <UserAvatar name={task.assigned_to || ""} />
  </div>
</motion.div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                      <button
  className="btn btn-sm btn-primary mt-2"
  disabled={!isManager()}
  title={!isManager() ? "Only managers can add tasks" : ""}
  onClick={() => isManager() && startAddTask(list.ID)}
>
  + Add Task
</button>

{!isManager() && (
  <div className="text-warning small mt-1">
    🔒 Only Managers can add tasks
  </div>
)}

                    </motion.div>
                      
                  </div>
                )}
              </Droppable>
            ))}

            {!showInput ? (
              <button className="add-list-box" onClick={() => setShowInput(true)}>
                + Add List
              </button>
            ) : (
              <div className="board-list">
                <input
                  className="form-control mb-2"
                  placeholder="List title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <button className="btn btn-success btn-sm" onClick={createList}>
                  Add
                </button>
              </div>
            )}
          </div>
        </DragDropContext>
      </div>
      {/* ---------------- ADD TASK MODAL ---------------- */}
{activeList && (
  <div className="task-panel-backdrop" onClick={() => setActiveList(null)}>
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="task-panel"
      onClick={(e) => e.stopPropagation()}
    >
      <h4>Add Task</h4>

      <input
        className="form-control my-2"
        placeholder="Task Title"
        value={taskTitle}
        onChange={(e) => setTaskTitle(e.target.value)}
      />

      <textarea
        className="form-control my-2"
        placeholder="Description"
        value={taskDesc}
        onChange={(e) => setTaskDesc(e.target.value)}
      />

      <select
        className="form-control my-2"
        value={taskAssign}
        onChange={(e) => setTaskAssign(e.target.value)}
      >
        <option value="">Assign To</option>
        <option value="Manager">Manager</option>
        <option value="Developer">Developer</option>
        <option value="QA">QA</option>
        <option value="Team Lead">Team Lead</option>
      </select>

      <input
        type="date"
        className="form-control my-2"
        value={taskDue}
        onChange={(e) => setTaskDue(e.target.value)}
      />

      <div className="d-flex justify-content-end gap-2 mt-3">
        <button className="btn btn-secondary" onClick={() => setActiveList(null)}>
          Cancel
        </button>
        <button className="btn btn-success" onClick={createTask}>
          Create
        </button>
      </div>
    </motion.div>
  </div>
)}


      {/* ---------------- TASK PANEL ---------------- */}
      {selectedTask && (
        <div className="task-panel-backdrop" onClick={() => setSelectedTask(null)}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="task-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {!editMode ? (
              <>
                <div className="d-flex justify-content-between">
                  <h4>{selectedTask.title}</h4>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setSelectedTask(null)}
                  >
                    ✖
                  </button>
                </div>

                <p className="text-muted">{selectedTask.description}</p>

                <p><b>Status:</b> {selectedTask.status}</p>
                <p><b>Priority:</b> {selectedTask.priority}</p>
                <p><b>Assigned To:</b> {selectedTask.assigned_to || "Not Assigned"}</p>
                <p><b>Due:</b> {getDueStatus(selectedTask.due_date).text}</p>

                {/* LABELS */}
                {selectedTask.labels && selectedTask.labels.length > 0 && (
                  <>
                    <h6 className="mt-3">Labels</h6>
                    <div className="d-flex gap-2 flex-wrap">
                      {selectedTask.labels.map((l, i) => (
                        <span key={i} className="badge bg-primary">
                          {l}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {/* ACTIVITY */}
                <h5 className="mt-3">Activity</h5>

<div className="activity-box">
  {taskActivity.length === 0 ? (
    <p>No activity yet</p>
  ) : (
    taskActivity.map((log, i) => (
      <div key={i} className="mb-2">
        <span>{activityIcon(log.action)}</span>{" "}
        <b>{log.actor_name || "User"}</b>{" "}
        {formatActivity(log)}{" "}
        <span className="text-muted" style={{ fontSize: "12px" }}>
          • {timeAgo(log.created_at)}
        </span>
      </div>
    ))
  )}
</div>



                {/* SUBTASKS */}
                <h5>Subtasks</h5>
                {subTasks.length === 0 ? (
                  <p className="text-muted">No subtasks yet</p>
                ) : (
                  subTasks.map((s) => (
                    <div
                      key={s.ID}
                      onClick={async () => {
                        await api.put(`/subtasks/toggle/${s.ID}`);
                        loadSubTasks(selectedTask.ID);
                      }}
                      style={{
                        padding: "6px",
                        borderRadius: "6px",
                        background: s.done ? "#4CAF50" : "#eee",
                        color: s.done ? "white" : "black",
                        cursor: "pointer",
                        marginBottom: "6px"
                      }}
                    >
                      {s.done ? "✔️ " : "⬜ "} {s.title}
                    </div>
                  ))
                )}

                <div className="d-flex gap-2">
                  <input
                    className="form-control"
                    placeholder="Add subtask…"
                    value={newSubTask}
                    onChange={(e) => setNewSubTask(e.target.value)}
                  />
                  <button
                    className="btn btn-success"
                    onClick={async () => {
                      if (!newSubTask.trim()) return;
                      await api.post("/subtasks", {
                        task_id: selectedTask.ID,
                        title: newSubTask
                      });
                      setNewSubTask("");
                      loadSubTasks(selectedTask.ID);
                    }}
                  >
                    Add
                  </button>
                </div>

                {/* COMMENTS */}
                <h5 className="mt-3">Comments</h5>
                <div className="activity-box">
                  {comments.length === 0
                    ? <p>No comments yet</p>
                    : comments.map((c, i) => <p key={i}>• {c.user}: {c.message}</p>)}
                </div>

                <div className="d-flex gap-2">
                  <input
                    className="form-control"
                    placeholder="Write a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={addComment}>
                    Send
                  </button>
                </div>
                <button
  className="btn btn-primary mt-3"
  disabled={!isManager()}
  onClick={() => {
    if (!isManager()) return;
    setEditMode(true);
    setEditTitle(selectedTask.title);
    setEditDesc(selectedTask.description || "");
    setEditStatus(selectedTask.status || "todo");
    setEditPriority(selectedTask.priority || "normal");
    setEditAssigned(selectedTask.assigned_to || "");
    setEditDueDate(selectedTask.due_date || "");
    setEditLabels((selectedTask.labels || []).join(","));
  }}
>
  Edit Task
</button>

{!isManager() && (
  <p className="text-warning small mt-1">
    🔒 View-only access. Contact a manager to edit.
  </p>
)}

                {isManager() && (
                <button className="btn btn-outline-danger mt-2" onClick={deleteTask}>
                  Delete
                </button>
                )}
              </>
            ) : (
              <>
                <h4>Edit Task</h4>
                {!isManager() && (
  <div style={{
  background: "rgba(255, 255, 255, 0.8)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(0,0,0,0.05)",
  padding: "16px 24px",
  position: "sticky",
  top: 0,
  zIndex: 10
}}>
  <h3 className="fw-bold m-0" style={{ color: "#0f172a" }}>Board Workspace</h3>
</div>
)}


                <input
                  className="form-control my-2"
                  value={editTitle}
                  disabled={!isManager()}
                  onChange={(e) => setEditTitle(e.target.value)}
                  
                />

                <textarea
                  className="form-control my-2"
                  value={editDesc}
                  disabled={!isManager()}
                  onChange={(e) => setEditDesc(e.target.value)}
                />

                <select
                  className="form-control my-2"
                  value={editStatus}
                  disabled={!isManager()}
                  onChange={(e) => setEditStatus(e.target.value)}
                  
                >
                  <option value="todo">Todo</option>
                  <option value="progress">In Progress</option>
                  <option value="done">Done</option>
                </select>

                <select
                  className="form-control my-2"
                  value={editPriority}
                  disabled={!isManager()}
                  onChange={(e) => setEditPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>

                <select
                  className="form-control my-2"
                  value={editAssigned}
                  disabled={!isManager()}
                  onChange={(e) => setEditAssigned(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  <option value="Manager">Manager</option>
                  <option value="Developer">Developer</option>
                  <option value="QA">QA</option>
                </select>

                <input
                  type="date"
                  className="form-control my-2"
                  value={editDueDate ? editDueDate.slice(0, 10) : ""}
                  disabled={!isManager()}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />

                <input
                  className="form-control my-2"
                  placeholder="Comma separated labels e.g Bug,UI,Backend"
                  value={editLabels}
                  disabled={!isManager()}
                  onChange={(e) => setEditLabels(e.target.value)}
                />

                <div className="d-flex justify-content-end gap-2">
  <button
    className="btn btn-secondary"
    onClick={() => setEditMode(false)}
  >
    Cancel
  </button>

  <button
    className="btn btn-success"
    disabled={!isManager()}
    title={!isManager() ? "Only managers can save changes" : ""}
    onClick={updateTask}
  >
    Save
  </button>
</div>

              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default BoardView;
