const plugin = {
  appOption: {
    "Single tag": async function(app) {
      try {
        await this._loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.5.0/jszip.min.js");
        const result = await app.prompt(
          "What tag do you want to export?",
          {
            inputs: [
              {
                label: "Tag name",
                type: "text",
                placeholder: "your/tag/name/here",
              },
            ]
          }
        );
        const searchResults = await app.filterNotes({tag: result});
        if (!searchResults) {
          await app.alert("No notes found with this tag.");
          return;
        }
  
        let fileContents = [];
        const progressNoteUUID = await app.createNote("Export progress...");
        const progressNote = await app.findNote({uuid: progressNoteUUID});
        await app.navigate(
          `https://www.amplenote.com/notes/${ progressNote.uuid }`
        );

        let index = 0;
        for (const noteHandle of searchResults) {
          await app.replaceNoteContent(
            progressNote,
            `Processing note ${ index + 1}/${ searchResults.length }...`
          );
          const note = await app.findNote(noteHandle);
          const content = await app.getNoteContent(note);
          fileContents.push({
            title: note.name,
            content: content
          });
          index = index + 1;
        }
  
        await app.replaceNoteContent(
          progressNote,
          `Creating zip file...`
        );
        const zipBlob = await this._createZipBlob(fileContents);
        await app.saveFile(zipBlob, `${ result.trim() }.zip`);
        await app.replaceNoteContent(
          progressNote,
          `Success!`
        );
      } catch (err) {
        await app.alert(err);
      }
    },

    "Everything to CSV": async function(app) {
      try {
        // This works fine with ~5000 notes on a modern laptop
        // Hard to say what happens on slower machines, or bigger accounts
        const notes = await app.filterNotes();
        let csvContent = "";
        csvContent += "UUID,Title,Tags,Content\n";

        let index = 1;

        for (const note of notes) {
          const content = await app.getNoteContent(note);
          // We escape all double quotes by adding anothe double quote before it
          // CSV standards dictate that we can wrap something between double quotes and
          // it will be considered as a single entry in a column (even with line breaks)
          let row = `"${note.uuid}","${note.name}","${note.tags.join(",")}","${content.replace(/"/g, '""')}"\n`;
          csvContent += row;

          if (csvContent.length > 1e5) {
            // Generate and download CSV when exceeding certain file size
            const finalBlob = new Blob([csvContent], {type: "text/csv"});
            await app.saveFile(finalBlob, `export-${ index }.csv`);
            csvContent = "";
            index += 1;
          }
        }
        return;
      } catch (err) {
        await app.alert(err); 
      }
    },
  },

  async _createZipBlob(notes) {
    let zip = new JSZip();
    notes.forEach((note, index) => {
      const sanitizedTitle = note.title.replace(/\//g, '-'); // Replace any '/' with '-'
      zip.file(`${sanitizedTitle}.md`, note.content);
    });

    // Generate ZIP data in Uint8Array format
    return zip.generateAsync({type: "uint8array"}).then(data => {
        // Convert data to a Blob using the Blob constructor
        return new Blob([data], {type: "application/zip"});
    });
  },
  
  async _loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },
}; 
export default plugin;
