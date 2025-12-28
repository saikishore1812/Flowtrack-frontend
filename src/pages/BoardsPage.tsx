import { useEffect, useState } from "react";
import api from "../api/api";

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface Board {
  ID: number;
  title: string;
  description: string;
}

const BoardsPage = () => {
    const navigate = useNavigate();

  const [boards, setBoards] = useState<Board[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const fetchBoards = async () => {
    const res = await api.get("/boards");
    setBoards(res.data);
  };

  const createBoard = async () => {
    if (!title.trim()) return;

    await api.post("/boards", {
      title,
      description,
      user_id: 1
    });

    setTitle("");
    setDescription("");
    setShowModal(false);
    fetchBoards();
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold">Your Boards</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Create Board
        </button>
      </div>

      {/* Boards Grid */}
      <div className="row">
        {boards.map((board) => (
          <div key={board.ID} className="col-md-4 mb-4">
            <motion.div
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.98 }}
  className="p-4 rounded shadow board-card"
  onClick={() => navigate(`/board/${board.ID}`)}
  style={{ cursor: "pointer" }}
>
  <h4 className="fw-semibold">{board.title}</h4>
  <p className="text-muted">{board.description || "No description"}</p>
</motion.div>

          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop-custom">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal-box"
          >
            <h4>Create New Board</h4>

            <input
              className="form-control my-2"
              placeholder="Board Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea 
              className="form-control my-2"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={createBoard}>
                Create
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
};

export default BoardsPage;
