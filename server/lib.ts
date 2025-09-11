export const readPdf = async (rawBuffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      import("pdfreader").then(({ PdfReader }) => {
            let fullText = "";
        new PdfReader().parseBuffer(rawBuffer, (err, item) => {
          if (err) {
            reject(err);
          } else if (!item) {
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