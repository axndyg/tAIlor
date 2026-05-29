// import { useState } from 'react' 

import './App.css'

function App() {


  return (
    <>
    <div id="sidebar">       
      <section className="upload">
        <label>upload resume files (.pdf or .tex files)</label>
        <form>
          <input type="file" id="myFile" name="filename" multiple accept=".tex,.pdf"/>
        </form>
      </section>
      <section>
        <label>tailor instructions</label>
        <textarea />
      </section>
      <section>
        <label>select model </label>
        <select name="llms" id="llms">
          <option>claude</option>
          <option>gemini</option>
          <option >chatgpt</option>
          <option>other</option>
        </select>
      </section>
            <section>
        <label>enter associated api key</label>
        <input type="password" />
      </section>
      <section>
        <label>output</label>
        holding
      </section>
      <section>
        <label>enter fallback desc</label>
        <textarea />
      </section>
    </div>
    </> 
  )
}

export default App
