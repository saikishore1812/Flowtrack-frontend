import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/api";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import socket from "../utils/socket";

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
}

interface List {
  ID: number;
  title: string;
  tasks?: Task[];
}

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

  // Edit
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("todo");
  const [editPriority, setEditPriority] = useState("normal");
  const [editAssigned, setEditAssigned] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

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
      due_date: formattedDate
    });

    setTaskTitle("");
    setTaskDesc("");
    setTaskAssign("");
    setTaskDue("");
    setActiveList(null);
    getLists();
  };

  // ---------------- LOAD LISTS ----------------
  const getLists = async () => {
    const res = await api.get(`/lists/${id}`);
    const listsData = res.data;

    const listsWithTasks = await Promise.all(
      listsData.map(async (list: any) => {
        const tasksRes = await api.get(`/tasks/${list.ID}`);
        return { ...list, tasks: tasksRes.data };
      })
    );

    setLists(listsWithTasks);
  };

  useEffect(() => {
    getLists();

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

    socket.onmessage = handleSocket;

    return () => {
      socket.onmessage = null;
    };
  }, [id]);

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

  // ---------------- ACTIVITY & COMMENTS ----------------
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

  // ---------------- SUBTASKS ----------------
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
      due_date: formattedDate
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

  // ---------------- DUE BADGE ----------------
  const getDueStatus = (date?: string) => {
    if (!date) return { text: "No Due Date", color: "#999" };

    const today = new Date();
    const due = new Date(date);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return { text: "Overdue", color: "#ff4d4d" };
    if (diff === 0) return { text: "Due Today", color: "#ffcc00" };
    if (diff <= 3) return { text: "Due Soon", color: "#ff9933" };

    return { text: due.toISOString().slice(0, 10), color: "#4CAF50" };
  };

  return (
    <div className="board-bg">
      <div className="container-fluid py-3">
        <h3 className="fw-bold text-white">Board Workspace</h3>

        <DragDropContext onDragEnd={handleDrag}>
          <div className="d-flex gap-3 mt-4 board-scroll">

            {lists.map((list) => (
              <Droppable droppableId={String(list.ID)} key={list.ID}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    <motion.div className="board-list" whileHover={{ scale: 1.02 }}>
                      <h5 className="fw-semibold mb-3">{list.title}</h5>

                      <div className="task-container">
                        {list.tasks?.map((task, index) => (
                          <Draggable draggableId={String(task.ID)} index={index} key={task.ID}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <motion.div
                                  className="task-card"
                                  whileHover={{ scale: 1.02 }}
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setEditMode(false);
                                    loadActivity(task.ID);
                                    loadComments(task.ID);
                                    loadSubTasks(task.ID);
                                  }}
                                >
                                  <strong>{task.title}</strong>

                                  <div className="mt-1">
                                    <span className={`task-badge status-${task.status}`}>
                                      {(task.status || "todo").toUpperCase()}
                                    </span>

                                    <span className={`task-badge priority-${task.priority}`}>
                                      {(task.priority || "normal").toUpperCase()}
                                    </span>
                                  </div>

                                  <p className="small text-muted m-0">
                                    {task.description || "No description"}
                                  </p>

                                  <p className="small text-muted m-0">
                                    Assigned: {task.assigned_to || "—"}
                                  </p>

                                  {task.due_date && (
                                    <p
                                      className="small fw-semibold m-0"
                                      style={{
                                        color: "#fff",
                                        background: getDueStatus(task.due_date).color,
                                        padding: "3px 8px",
                                        display: "inline-block",
                                        borderRadius: "6px",
                                        marginTop: "6px"
                                      }}
                                    >
                                      {getDueStatus(task.due_date).text}
                                    </p>
                                  )}
                                </motion.div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>

                      <button className="btn btn-sm btn-primary mt-2" onClick={() => startAddTask(list.ID)}>
                        + Add Task
                      </button>
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

            <input className="form-control my-2" placeholder="Task Title"
              value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />

            <textarea className="form-control my-2" placeholder="Description"
              value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />

            <select className="form-control my-2"
              value={taskAssign} onChange={(e) => setTaskAssign(e.target.value)}>
              <option value="">Assign To</option>
              <option value="Manager">Manager</option>
              <option value="Developer">Developer</option>
              <option value="QA">QA</option>
              <option value="Team Lead">Team Lead</option>
            </select>

            <input type="date" className="form-control my-2"
              value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />

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
                  <button className="btn btn-danger btn-sm" onClick={() => setSelectedTask(null)}>
                    ✖
                  </button>
                </div>

                <p className="text-muted">{selectedTask.description}</p>

                <p><b>Status:</b> {selectedTask.status}</p>
                <p><b>Priority:</b> {selectedTask.priority}</p>
                <p><b>Assigned To:</b> {selectedTask.assigned_to || "Not Assigned"}</p>

                <p><b>Due:</b> {getDueStatus(selectedTask.due_date).text}</p>

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
                  <input className="form-control"
                    placeholder="Add subtask…"
                    value={newSubTask}
                    onChange={(e) => setNewSubTask(e.target.value)}
                  />
                  <button className="btn btn-success"
                    onClick={async () => {
                      if (!newSubTask.trim()) return;
                      await api.post("/subtasks", {
                        task_id: selectedTask.ID,
                        title: newSubTask
                      });
                      setNewSubTask("");
                      loadSubTasks(selectedTask.ID);
                    }}>
                    Add
                  </button>
                </div>

                {/* Comments */}
                <h5 className="mt-3">Comments</h5>
                <div className="activity-box">
                  {comments.length === 0 ? <p>No comments yet</p> :
                    comments.map((c, i) => <p key={i}>• {c.user}: {c.message}</p>)
                  }
                </div>

                <div className="d-flex gap-2">
                  <input className="form-control"
                    placeholder="Write a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={addComment}>
                    Send
                  </button>
                </div>

                <button className="btn btn-primary mt-3"
                  onClick={() => {
                    setEditMode(true);
                    setEditTitle(selectedTask.title);
                    setEditDesc(selectedTask.description || "");
                    setEditStatus(selectedTask.status || "todo");
                    setEditPriority(selectedTask.priority || "normal");
                    setEditAssigned(selectedTask.assigned_to || "");
                    setEditDueDate(selectedTask.due_date || "");
                  }}>
                  Edit Task
                </button>

                <button className="btn btn-outline-danger mt-2" onClick={deleteTask}>
                  Delete
                </button>
              </>
            ) : (
              <>
                <h4>Edit Task</h4>

                <input className="form-control my-2"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />

                <textarea className="form-control my-2"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />

                <select className="form-control my-2"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="todo">Todo</option>
                  <option value="progress">In Progress</option>
                  <option value="done">Done</option>
                </select>

                <select className="form-control my-2"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>

                <select className="form-control my-2"
                  value={editAssigned}
                  onChange={(e) => setEditAssigned(e.target.value)}>
                  <option value="">Unassigned</option>
                  <option value="Manager">Manager</option>
                  <option value="Developer">Developer</option>
                  <option value="QA">QA</option>
                </select>

                <input type="date" className="form-control my-2"
                  value={editDueDate ? editDueDate.slice(0, 10) : ""}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />

                <div className="d-flex justify-content-end gap-2">
                  <button className="btn btn-secondary" onClick={() => setEditMode(false)}>
                    Cancel
                  </button>

                  <button className="btn btn-success" onClick={updateTask}>
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
