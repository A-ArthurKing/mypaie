import sys

file_path = "frontend/src/Pages/ReglesPrimes/Components/CreateRegleModal/CreateRegleModal.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

if "import CustomSelect" not in content:
    content = content.replace("import \"./CreateRegleModal.css\";", "import CustomSelect from \"../../../../Shared/CustomSelect/CustomSelect\";\nimport \"./CreateRegleModal.css\";")

old_projet = """<select id="projet_id" name="projet_id" value={selections.projet_id} onChange={handleSelectionChange}>
                  <option value="">-- Sélectionner un projet ({refs.projets.length} disponible(s)) --</option>
                  {refs.projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
                </select>"""
new_projet = """<CustomSelect id="projet_id" name="projet_id" value={selections.projet_id} onChange={handleSelectionChange} placeholder={`-- Sélectionner un projet (${refs.projets.length} disponible(s)) --`} options={refs.projets.map(p => ({ value: p.id, label: p.libelle }))} />"""
content = content.replace(old_projet, new_projet)

old_op = """<select 
                    id="id_operation" 
                    name="id_operation" 
                    value={selections.id_operation} 
                    onChange={handleSelectionChange}
                    disabled={!selections.projet_id}
                  >
                    <option value="">-- {filteredOperations.length} opération(s) --</option>
                    {filteredOperations.map(o => <option key={o.id} value={o.id}>{o.libelle}</option>)}
                  </select>"""
new_op = """<CustomSelect id="id_operation" name="id_operation" value={selections.id_operation} onChange={handleSelectionChange} isDisabled={!selections.projet_id} placeholder={`-- ${filteredOperations.length} opération(s) --`} options={filteredOperations.map(o => ({ value: o.id, label: o.libelle }))} />"""
content = content.replace(old_op, new_op)

old_file = """<select 
                    id="id_file" 
                    name="id_file" 
                    value={selections.id_file} 
                    onChange={handleSelectionChange}
                    disabled={!selections.id_operation}
                  >
                    <option value="">-- {filteredFiles.length} file(s) --</option>
                    {filteredFiles.map(f => <option key={f.id} value={f.id}>{f.libelle}</option>)}
                  </select>"""
new_file = """<CustomSelect id="id_file" name="id_file" value={selections.id_file} onChange={handleSelectionChange} isDisabled={!selections.id_operation} placeholder={`-- ${filteredFiles.length} file(s) --`} options={filteredFiles.map(f => ({ value: f.id, label: f.libelle }))} />"""
content = content.replace(old_file, new_file)

old_act = """<select 
                    id="id_activite" 
                    name="id_activite" 
                    value={selections.id_activite} 
                    onChange={handleSelectionChange}
                    disabled={!selections.id_operation}
                  >
                    <option value="">-- {filteredActivites.length} activité(s) --</option>
                    {filteredActivites.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
                  </select>"""
new_act = """<CustomSelect id="id_activite" name="id_activite" value={selections.id_activite} onChange={handleSelectionChange} isDisabled={!selections.id_file} placeholder={`-- ${filteredActivites.length} activité(s) --`} options={filteredActivites.map(a => ({ value: a.id, label: a.libelle }))} />"""
content = content.replace(old_act, new_act)

old_per = """<select id="periodicite" name="periodicite" value={formData.periodicite} onChange={handleChange}>
                  <option value="mensuelle">Mensuelle</option>
                  <option value="trimestrielle">Trimestrielle</option>
                  <option value="annuelle">Annuelle</option>
                </select>"""
new_per = """<CustomSelect id="periodicite" name="periodicite" value={formData.periodicite} onChange={handleChange} options={[ { value: "mensuelle", label: "Mensuelle" }, { value: "trimestrielle", label: "Trimestrielle" }, { value: "annuelle", label: "Annuelle" } ]} />"""
content = content.replace(old_per, new_per)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")

