export const readPdf = async (rawBuffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      import("pdfreader").then(({ PdfReader }) => {
            let fullText = "";
        new PdfReader().parseBuffer(rawBuffer, (err, item) => {
            console.log("buffer length", rawBuffer.length);
            console.log("item", item?.text);

          if (err) {
            reject(err);
          } else if (!item) {
            console.warn("end of file");
            resolve(fullText);
          } else if (item.text) {
            fullText += item.text;
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
};