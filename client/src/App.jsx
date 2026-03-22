import { useEffect, useState } from "react";
import "./App.css";

const BACKEND_URL = "https://fridgeguard.onrender.com";

function App() {
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [image, setImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetch(`${BACKEND_URL}/health`).catch(() => {
      console.log("Health check failed or backend is sleeping.");
    });
  }, []);

  const analyzeFridge = async () => {
    if (!selectedFile) {
      alert("Please take or choose a fridge photo first.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setStatusText("Analyzing fridge image...");

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const foodController = new AbortController();
      const foodTimeout = setTimeout(() => {
        foodController.abort();
      }, 70000);

      const foodResponse = await fetch(
        `${BACKEND_URL}/api/analyze-fridge`,
        {
          method: "POST",
          body: formData,
          signal: foodController.signal,
        }
      );

      clearTimeout(foodTimeout);

      const foodData = await foodResponse.json();

      if (!foodResponse.ok) {
        throw new Error(foodData.error || "Food analysis failed.");
      }

      const items = foodData.items || [];
      setFoods(items);

      setStatusText("Generating recipe ideas...");

      const recipeController = new AbortController();
      const recipeTimeout = setTimeout(() => {
        recipeController.abort();
      }, 45000);

      const recipeResponse = await fetch(
        `${BACKEND_URL}/api/recipes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items }),
          signal: recipeController.signal,
        }
      );

      clearTimeout(recipeTimeout);

      const recipeData = await recipeResponse.json();
      console.log("Recipe response:", recipeData);

      if (!recipeResponse.ok) {
        throw new Error(recipeData.error || "Recipe generation failed.");
      }

      const recipeList = recipeData.recipes || [];

      if (recipeList.length === 0) {
        setRecipes([
          "Simple veggie omelet",
          "Fresh fridge salad",
          "Quick mixed vegetable skillet",
        ]);
      } else {
        setRecipes(recipeList);
      }

      setStatusText("Done!");
    } catch (error) {
      console.error(error);

      if (error.name === "AbortError") {
        setErrorMessage(
          "The server took too long to respond. Render may be waking up."
        );
      } else {
        setErrorMessage(error.message || "Something went wrong.");
      }

      setRecipes([
        "Simple veggie omelet",
        "Fresh fridge salad",
        "Quick mixed vegetable skillet",
      ]);
    } finally {
      setLoading(false);

      setTimeout(() => {
        setStatusText("");
      }, 1500);
    }
  };

  const expiringSoon = foods.filter((food) => food.daysLeft <= 2).length;
  const estimatedSavings = expiringSoon * 5;

  return (
    <div className="page">
      <div className="card">
        <h1>FridgeGuard</h1>
        <p className="subtitle">
          Snap a fridge photo, find what to use first, and get meal ideas fast.
        </p>

        <div className="stats">
          <div className="stat-box">
            <h3>{foods.length}</h3>
            <p>Foods Found</p>
          </div>
          <div className="stat-box">
            <h3>{expiringSoon}</h3>
            <p>Use Soon</p>
          </div>
          <div className="stat-box">
            <h3>${estimatedSavings}</h3>
            <p>Est. Savings</p>
          </div>
        </div>

        <div className="upload-section">
          <label htmlFor="cameraInput" className="camera-btn">
            Take / Choose Fridge Photo
          </label>

          <input
            id="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFile(file);
                setImage(URL.createObjectURL(file));
                setFoods([]);
                setRecipes([]);
                setErrorMessage("");
                setStatusText("");
              }
            }}
          />

          <button
            onClick={analyzeFridge}
            className="analyze-btn"
            disabled={loading}
          >
            {loading ? "Working..." : "Analyze Fridge"}
          </button>

          {statusText && <p className="status-text">{statusText}</p>}
          {errorMessage && <p className="error-text">{errorMessage}</p>}
        </div>

        {image && (
          <div className="image-preview">
            <img src={image} alt="Fridge preview" />
          </div>
        )}

        <div className="results-grid">
          <div className="results-box">
            <h2>Food Found</h2>
            {foods.length === 0 ? (
              <p className="empty-text">No foods shown yet.</p>
            ) : (
              <ul>
                {foods.map((food, index) => (
                  <li key={index} className="food-item">
                    <div>
                      <strong>{food.name}</strong>
                      <p>{food.daysLeft} day(s) left</p>
                    </div>
                    {food.daysLeft <= 2 && (
                      <span className="warning">Use soon</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="results-box">
            <h2>Recipe Ideas</h2>
            {recipes.length === 0 ? (
              <p className="empty-text">No recipes shown yet.</p>
            ) : (
              <ul>
                {recipes.map((recipe, index) => (
                  <li key={index} className="recipe-item">
                    {recipe}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;