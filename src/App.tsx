import { BrowserRouter, Routes, Route } from "react-router-dom";
import BoardsPage from "./pages/BoardsPage";
import BoardView from "./pages/BoardView";
import LoginPage from "./pages/LoginPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BoardsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/board/:id" element={<BoardView />} />
      </Routes>

    </BrowserRouter>
  );
}

export default App;
