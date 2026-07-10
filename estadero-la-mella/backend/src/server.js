const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🍻 Estadero La Mella API corriendo en http://localhost:${PORT}`);
});
