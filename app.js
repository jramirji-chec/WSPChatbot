const { createBot, createProvider, createFlow, addKeyword,EVENTS } = require('@bot-whatsapp/bot')
const QRPortalWeb = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')
const fs = require("fs") // para poder leer el archivo del path
const path = require("path");
const csv = require("csv-parser");
const { spawn } = require('child_process');
//const { handlerAI } = require("./speechToText") // para poder usar la función de transcripción
const { handlerAI } = require("./speechToText_solojs") // para poder usar la función de transcripción
const { delay } = require('@whiskeysockets/baileys')
const { buscarPorNombre } = require("./Leer_archivos"); // Importar la función desde Leer_archivos.js
const { buscarPorCedula } = require("./Leer_archivos"); // Importar la función desde Leer_archivos.js
const sharedData = {};


// const usersData = {}; // Almacén temporal de datos de usuarios
// const csvFilePath = "reportes.csv"; // Ruta del archivo CSV
const jsonFilePath = path.join(__dirname, "reportes.json"); // Ruta del archivo JSON

//const csvFilePath = path.join(__dirname, "reportes.csv");
const usersData = {}; // Almacén temporal de datos de usuarios

// FUNCION PARA ELIMINAR ACENTOS
function eliminarAcentos(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// FUNCION PARA DAR ESPERA ENTRE ACCIONES
function espera(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Flujo principal
const flowPrincipal = addKeyword(['hola', 'ole', 'alo'])
    .addAnswer("¡Hola, estamos validando tu información, por favor espera un momento...🔄", null, async (ctx, ctxFn) => {
        // Esperar 5 segundos antes de continuar
        await espera(5000);

        const userId = ctx.from;
        let encontrado = false;
        let Nnombre = "";
        let Ncedula = "";
        let Ntelefono = "";
        let Ncodigo = "";

        try {
            // Leer el archivo JSON
            let jsonData = [];
            if (fs.existsSync(jsonFilePath)) {
                const fileContent = fs.readFileSync(jsonFilePath, "utf8");
                jsonData = JSON.parse(fileContent);
            }

            // Buscar el número de teléfono en los datos del JSON
            const usuario = jsonData.find((row) => row.telefono === userId);
            

            if (usuario) {
                encontrado = true;
                Nnombre = usuario.nombre;
                Ncedula = usuario.cedula;
                Ntelefono = usuario.telefono;
                Ncodigo = usuario.codigo;

                console.log("El nombre es:", Nnombre);
                console.log("La cédula es:", Ncedula);
                console.log("El teléfono es:", Ntelefono);
                console.log("El código es:", Ncodigo);

                usersData[userId] = {
                    nombre: Nnombre,
                    cedula: Ncedula,
                    telefono: Ntelefono,
                    codigo: Ncodigo,
                    fechaHora: new Date().toLocaleString("es-ES").replace(",", ""), // Formatear fecha y hora
                };

                await ctxFn.flowDynamic(`¡Bienvenido de nuevo, *${Nnombre}*! 😊`);
                await espera(2000);
                await ctxFn.flowDynamic("Por favor, envíame una nota de voz que sea clara y pausada, describiendo tu reporte o incidente.");
            } else {
                // Redirigir al flujo `flujoInicial` si el número no existe
                await ctxFn.gotoFlow(flujoInicial);
            }
        } catch (error) {
            console.error("Error al leer el archivo JSON:", error);
            await ctxFn.flowDynamic("Lo siento, ocurrió un error al verificar tu información. Por favor, intenta más tarde.");
        }
    });


// Flujo inicial
const flujoInicial = addKeyword(['hola', 'ole', 'alo'])
    .addAnswer("¡Bienvenido! Soy *ChatbotCHEC*.", { delay: 2000 })
    .addAnswer("Acá puedes reportar incidentes, a través de notas de voz.", { delay: 500 })
    .addAnswer(
        "Para comenzar, indica para quién vas a realizar el reporte, responde con:\n\n1️⃣ Reporte a mi Nombre.\n2️⃣ Reporte a Nombre de otra persona.",
        { delay: 2000, capture: true },async (ctx, { gotoFlow, fallBack }) => {
            const opcion = ctx.body.trim();
            sharedData.opcionSeleccionada = opcion; // Guardar en el objeto compartido
            //console.log("Opción seleccionada:", sharedData.opcionSeleccionada);

            if (opcion === '1') {
                return gotoFlow(flujoNombrePropio);
            } else if (opcion === '2') {
                return gotoFlow(flujoValidarOtro);
            } else {
                return fallBack("Opción no válida. Por favor, responde con 1 o 2.");
            }
        }
    );

// Flujo para validar remitente por nombre propio
const flujoNombrePropio = addKeyword('flujoPropio')
    .addAnswer("Por favor, indícame tu *Nombre completo* para validar los datos:", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const nombre = eliminarAcentos(ctx.body.trim());

        await flowDynamic("Estamos validando tu información, por favor espera un momento...🔄");
        await espera(3000);

        const resultados = await buscarPorNombre(nombre);

        if (resultados.length === 0) {
            await flowDynamic("❌ No se encontraron datos para la persona ingresada. Por favor verifica el nombre y vuelve a intentarlo.");
            return gotoFlow(flujoInicial);
        }

        if (resultados.length === 1) {
            const r = resultados[0];
            usersData[userId] = {
                remitente: {
                    nombre: r.nombre,
                    cedula: r.cedula,
                    codigo: r.usuario
                }
            };

            await flowDynamic(`✅ ¡Hola, *${r.nombre}*!\nTú cédula es: *${r.cedula}*\nTú código es: *${r.usuario}*`);
            //return gotoFlow(flujoValidarDestino);
            await espera(1000);
            await flowDynamic("Ahora, por favor envíame una *nota de voz* con el reporte del incidente.");
            return;
        }

        if (resultados.length > 1) {
        // Hay más de un resultado, mostrar opciones
        await procesarMultiplesCoincidencias(resultados, state, flowDynamic);
        return gotoFlow(flujoSeleccionMultiplesCoincidencias);
        }        
    })
    


async function procesarMultiplesCoincidencias(resultados, state, flowDynamic) {
    const opcionesTexto = resultados.map((r, i) => `*${i + 1}*. ${r.nombre}`).join('\n');
    await flowDynamic(`⚠️ Se encontraron múltiples coincidencias:\n\n${opcionesTexto}`);
    await state.update({ posiblesCoincidencias: resultados });
}

const flujoSeleccionMultiplesCoincidencias = addKeyword('seleccionMultiplesCoincidencias')
    .addAnswer("Por favor selecciona un número de la lista...", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const seleccion = parseInt(ctx.body.trim());
        const posibles = state.get("posiblesCoincidencias");

        if (!posibles || isNaN(seleccion) || seleccion < 1 || seleccion > posibles.length) {
            await flowDynamic("❌ Opción inválida. Por favor escribe el número correcto de la lista mostrada.");
            return;
        }

        const seleccionado = posibles[seleccion - 1];
        usersData[userId] = {
            remitente: {
                nombre: seleccionado.nombre,
                cedula: seleccionado.cedula,
                codigo: seleccionado.usuario
            }
        };

        await flowDynamic(`✅ ¡Hola, *${seleccionado.nombre}*!\nTu cédula es: *${seleccionado.cedula}*\nTu código es: *${seleccionado.usuario}*`);
        //return gotoFlow(flujoValidarDestino);
        // Usar el valor en otra función
        if (sharedData.opcionSeleccionada=== '1') {
            console.log("Opción seleccionada:", sharedData.opcionSeleccionada);
            await flowDynamic("Ahora, por favor envíame una *nota de voz* que sea clara y pausada con el reporte del incidente.");
        }
        if (sharedData.opcionSeleccionada=== '2') {
            console.log("Opción seleccionada:", sharedData.opcionSeleccionada);
            //await flowDynamic("Ahora: ¿Cuál es el *Nombre Completo* de la persona para quien haces el reporte?");
            //return gotoFlow(flujoNombrePropio);
            return gotoFlow(flujoValidarDestino);
            //return gotoFlow(flujoValidarOtro);
        }

        // Resetear la variable al finalizar el flujo
    sharedData.opcionSeleccionada = null;
        
        
    });
const flujoSeleccionMultiplesCoincidencias2 = addKeyword('seleccionMultiplesCoincidencias2')
    .addAnswer("Por favor selecciona un número de la lista...", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const seleccion = parseInt(ctx.body.trim());
        const posibles = state.get("posiblesCoincidencias");

        if (!posibles || isNaN(seleccion) || seleccion < 1 || seleccion > posibles.length) {
            await flowDynamic("❌ Opción inválida. Por favor escribe el número correcto de la lista mostrada.");
            return;
        }

        const seleccionado = posibles[seleccion - 1];
        usersData[userId] = {
            remitente: {
                nombre: seleccionado.nombre,
                cedula: seleccionado.cedula,
                codigo: seleccionado.usuario
            }
        };

        await flowDynamic(`✅ ¡Hola, *${seleccionado.nombre}*!\nTu cédula es: *${seleccionado.cedula}*\nTu código es: *${seleccionado.usuario}*`);
        //return gotoFlow(flujoValidarDestino);
        // Usar el valor en otra función
        console.log("Opción seleccionada:", sharedData.opcionSeleccionada);
        await flowDynamic("Ahora, por favor envíame una *nota de voz* que sea clara y pausada con el reporte del incidente.");
       

        // Resetear la variable al finalizar el flujo
    sharedData.opcionSeleccionada = null;
        
    });


 const flujoValidarOtro = addKeyword('validarOtro')
    .addAnswer("Por favor, indícame tu Nombre y Apellido para validar los datos:", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const nombre = eliminarAcentos(ctx.body.trim());

        await flowDynamic("Estamos validando tu información, por favor espera un momento...🔄");
        await espera(3000);

        const resultados = await buscarPorNombre(nombre);


        if (resultados.length === 0) {
            await flowDynamic("❌ No se encontraron datos para la persona buscada. Por favor vuelve a intentarlo.");
            await espera(3000);
            return gotoFlow(flujoInicial);
        }

        if (resultados.length === 1) {
            const r = resultados[0];
            usersData[userId] = {
                remitente: {
                    nombre: r.nombre,
                    cedula: r.cedula,
                    codigo: r.usuario
                }
            };

            await flowDynamic(`✅ ¡Hola, *${r.nombre}*!\nTú cédula es: *${r.cedula}*\nTú código es: *${r.usuario}*`);
            return gotoFlow(flujoValidarDestino);
            // await espera(1000);
            // await flowDynamic("Ahora, por favor envíame una *nota de voz* con el reporte del incidente.");
            // return;
        }

        if (resultados.length > 1) {
        // Hay más de un resultado, mostrar opciones
        await procesarMultiplesCoincidencias(resultados, state, flowDynamic);
        return gotoFlow(flujoSeleccionMultiplesCoincidencias);
        }    
    })

// // Paso 4: flujo para validar destinatario del reporte
const flujoValidarDestino = addKeyword('validarDestino')
    .addAnswer("Ahora: ¿Cuál es el *Nombre Completo* de la persona para quien haces el reporte?", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const nombre = eliminarAcentos(ctx.body.trim());

        await flowDynamic("Buscando los datos de esta persona...🔍");
        await espera(3000);

        const resultados = await buscarPorNombre(nombre);
        if (resultados.length === 0) {
            await flowDynamic("❌ No se encontraron datos. Por favor verifica el nombre y vuelve a intentarlo.");
            await espera(3000);
            return gotoFlow(flujoSeleccionManualOBusqueda);
        }
         if (resultados.length === 1) {
            const r = resultados[0];
            usersData[userId] = {
                remitente: {
                    nombre: r.nombre,
                    cedula: r.cedula,
                    codigo: r.usuario
                }
            };

            await flowDynamic(`✅ ¡La persona es, *${r.nombre}*!\nSu cédula es: *${r.cedula}*\nSu código es: *${r.usuario}*`);
            //return gotoFlow(flujoValidarDestino);
            await espera(1000);
            await flowDynamic("Ahora, por favor envíame una *nota de voz* con el reporte del incidente.");
            return;
        }

        if (resultados.length > 1) {
        // Hay más de un resultado, mostrar opciones
        await procesarMultiplesCoincidencias(resultados, state, flowDynamic);
        return gotoFlow(flujoSeleccionMultiplesCoincidencias2);
        }    
    })


const flujoSeleccionManualOBusqueda = addKeyword('seleccionManualOBusqueda')
  .addAnswer(
    "¿Deseas volver a buscar, o ingresar los datos manualmente?\n\n1️⃣ Volver a buscar.\n2️⃣ Ingresar datos manualmente.",
    { capture: true },
    async (ctx, { gotoFlow, fallBack }) => {
      const opcion = ctx.body.trim();
      console.log("Opción seleccionada:", opcion);

      if (opcion === '1') {
        return gotoFlow(flujoValidarDestino); // o el flujo de búsqueda original
      } else if (opcion === '2') {
        return gotoFlow(Nuevapersona); // flujo de ingreso manual
      } else {
        return fallBack("Opción no válida. Por favor responde con 1 o 2.");
      }
    }
  );

//Flujo para ingresar datos de la nueva persona en caso de que no exista
const Nuevapersona = addKeyword('Nuevapersona') //{ capture: true }, async (ctx, { state }) => {     // { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
  // Paso 1: Nombre completo
  .addAnswer("📝 Por favor ingresa los *Nombres y Apellidos* completos:", { capture: true }, async (ctx, { state }) => {
    const nombre = ctx.body.trim();
    await state.update({ nombreManual: nombre });
  })

  // Paso 2: Cédula
  .addAnswer("🔢 Ingresa el número de *cédula* (7 a 10 dígitos):", { capture: true }, async (ctx, { state, flowDynamic, fallBack }) => {
    const cedula = ctx.body.trim();

    if (!/^\d{7,10}$/.test(cedula)) {
      await flowDynamic("❌ La cédula debe contener entre *7 y 10 dígitos numéricos*. Intenta nuevamente.");
      return fallBack();
    }

    await state.update({ cedulaManual: cedula });
  })

  // Paso 3: Teléfono
  .addAnswer("📱 Ingresa el número de *teléfono* (7 a 10 dígitos):", { capture: true }, async (ctx, { state, flowDynamic, fallBack }) => {
    const telefono = ctx.body.trim();

    if (!/^\d{7,10}$/.test(telefono)) {
      await flowDynamic("❌ El número de teléfono debe tener entre *7 y 10 dígitos*. Intenta nuevamente.");
      return fallBack();
    }

    await state.update({ telefonoManual: telefono });

    // Mostrar resumen
    const nombre = await state.get("nombreManual");
    const cedula = await state.get("cedulaManual");

    await flowDynamic(`✅ *Datos ingresados:*\n📌 Nombre: *${nombre}*\n🪪 Cédula: *${cedula}*\n📞 Teléfono: *${telefono}*`);
  })

  .addAnswer("¿Son correctos? Responde con:\n1️⃣ Sí, son correctos.\n2️⃣ No, quiero volver a ingresarlos.", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
    const userId = ctx.from;
    const opcion = ctx.body.trim();

    const nombre = state.get("nombreManual");
    const cedula = state.get("cedulaManual");
    const telefono = state.get("telefonoManual");

    if (opcion === "1") {
      usersData[userId] = {
        nombre,
        cedula,
        telefono,
        fechaHora: new Date().toLocaleString("es-ES").replace(",", ""),
      };

      await flowDynamic("✅ Los datos han sido guardados correctamente.\n\nAhora, por favor envíame una *nota de voz* con el reporte del incidente.");
    } else if (opcion === "2") {
      return gotoFlow(Nuevapersona); // reiniciar ingreso manual
    } else {
      return await flowDynamic("❌ Opción no válida. Por favor, responde con 1 o 2.");
    }
  });

// const Nuevapersona = addKeyword(['datosManual', 'ingresarDatos'])

//   // Paso 1: Nombre completo
//   .addAnswer("📝 Por favor ingresa los *Nombres y Apellidos* completos:", { capture: true }, async (ctx, { state }) => {
//     const nombre = ctx.body.trim();
//     await state.update({ nombreManual: nombre });
//   })

//   // Paso 2: Cédula
//   .addAnswer("🔢 Ingresa el número de *cédula* (7 a 10 dígitos):", { capture: true }, async (ctx, { state, flowDynamic, fallBack }) => {
//     const cedula = ctx.body.trim();

//     if (!/^\d{7,10}$/.test(cedula)) {
//       await flowDynamic("❌ La cédula debe contener entre *7 y 10 dígitos numéricos*. Intenta nuevamente.");
//       return fallBack();
//     }

//     await state.update({ cedulaManual: cedula });
//   })

//   // Paso 3: Teléfono
//   .addAnswer("📱 Ingresa el número de *teléfono* (7 a 10 dígitos):", { capture: true }, async (ctx, { state, flowDynamic, fallBack }) => {
//     const telefono = ctx.body.trim();

//     if (!/^\d{7,10}$/.test(telefono)) {
//       await flowDynamic("❌ El número de teléfono debe tener entre *7 y 10 dígitos*. Intenta nuevamente.");
//       return fallBack();
//     }

//     await state.update({ telefonoManual: telefono });

//     // Mostrar resumen
//     const nombre = await state.get("nombreManual");
//     const cedula = await state.get("cedulaManual");

//     await flowDynamic(`✅ *Datos ingresados:*\n📌 Nombre: *${nombre}*\n🪪 Cédula: *${cedula}*\n📞 Teléfono: *${telefono}*`);
//   })

//   // Paso 4: Confirmación final
//   .addAnswer("¿Son correctos estos datos?\n\n1️⃣ Sí, continuar.\n2️⃣ No, quiero volver a ingresarlos.",
//     { capture: true },
//     async (ctx, { gotoFlow, fallBack }) => {
//       const opcion = ctx.body.trim();

//       if (opcion === "1") {
//         await flowDynamic("✅ Perfecto. Los datos han sido registrados.");
//         // Puedes redirigir a otro flujo si quieres:
//         // return gotoFlow(siguienteFlujo);
//       } else if (opcion === "2") {
//         await flowDynamic("🔁 Vamos a volver a ingresar los datos.");
//         return  gotoFlow(Nuevapersona); // Reinicia el flujo
//       } else {
//         return fallBack("❌ Opción no válida. Por favor responde con 1 o 2.");
//       }
//     }
//   );

// Flujo para manejar la nota de voz 
const flowVoice = addKeyword(EVENTS.VOICE_NOTE).addAnswer("Procesando nota de voz...🔄", null, async (ctx, ctxFn) => {
    try {
        const userId = ctx.from;
        const text = await handlerAI(ctx); // Convertir la nota de voz a texto

        // Reemplazar comas por puntos
        const textoSinComas = text.replace(/,/g, "."); // Reemplaza todas las comas por puntos
        const textoSinAcentos = eliminarAcentos(textoSinComas); // Elimina los acentos del texto

        console.log(`Texto procesado: ${textoSinAcentos}`);

        if (!usersData[userId]) usersData[userId] = {}; // Asegurar que el objeto existe
        usersData[userId].texto = textoSinAcentos; // Guardar el texto procesado sin las comas

        await ctxFn.flowDynamic(`*Transcripción*: ${textoSinAcentos}`); // Mostrar texto procesado con comas
        await espera(4000);
        await ctxFn.flowDynamic(
                        "Si estás de acuerdo con la transcripción, responde con:\n\n1️⃣ Sí, estoy de acuerdo.\n2️⃣ No, quiero volver a enviarla.",
                        { delay: 500 }
                    );

        
    } catch (error) {
        console.error("Error en el flujo de notas de voz:", error);
        await ctxFn.flowDynamic("Lo siento, no pude procesar tu nota de voz.");
    }
});



// Flujo para manejar la respuesta del usuario después de la transcripción
const flowWelcome = addKeyword(EVENTS.WELCOME)
.addAction(async (ctx, ctxFn) =>{
    const userId = ctx.from;
    //const respuesta = ctx.body.trim();
    if (ctx.body.includes("1")){
        if (usersData[userId].nombre && usersData[userId].cedula && usersData[userId].codigo && usersData[userId].texto) {
        //writeToCSV(usersData[userId]); // Guardar en el CSV
            writeToJSON(usersData[userId]); // Guardar en el archivo JSON
            delete usersData[userId]; // Limpiar el almacenamiento del usuario
    }
        await ctxFn.flowDynamic("¡Gracias por utilizar *ChatbotCHEC*! Te esperamos pronto. 👋");
    }else if (ctx.body.includes("2")){
        await ctxFn.flowDynamic("Por favor, vuelve a enviar tu nota de voz para procesarla nuevamente.");
    }else if (["3", "4", "5", "6", "7", "8", "9", "0"].includes(ctx.body)) {
        await ctxFn.flowDynamic("Opción no válida. Por favor, responde con 1️⃣ o 2️⃣.");
    }else {
        await ctxFn.gotoFlow(flowPrincipal); // Vuelve a preguntar hasta que ingrese 1 o 2
    console.log("Valor capturado: ",ctx.body) // Con esta funcion, imprimimos lo que escribio el usuario en WSP en la consola PC
    // await ctxFn.flowDynamic(`Bienvenido: ${ctx.body}`);  
}
}
)


// 🔹 Función para escribir en el archivo JSON
const writeToJSON = (data) => {
    let jsonData = [];

    // Leer el archivo JSON si ya existe
    if (fs.existsSync(jsonFilePath)) {
        const fileContent = fs.readFileSync(jsonFilePath, "utf8");
        jsonData = JSON.parse(fileContent);
    }

    // Agregar los nuevos datos al arreglo
    jsonData.push(data);

    // Escribir el arreglo actualizado en el archivo JSON
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 4), "utf8");
};

// 🔹 Función para escribir en el archivo CSV
const writeToCSV = (data) => {
    const headers = "Nombre,Cedula,Telefono,Codigo,Texto Procesado,Fecha y Hora\n";

    if (!fs.existsSync(csvFilePath)) {
        fs.writeFileSync(csvFilePath, headers); // Crear archivo con encabezados si no existe
    }

    // Insertar los datos en una sola línea
    const row = `${data.nombre},${data.cedula},${data.telefono},${data.codigo},${data.texto},${data.fechaHora}\n`;
    fs.appendFileSync(csvFilePath, row, "utf8");
};


const main = async () => {
    const adapterDB = new MockAdapter()  //flujoValidarRemitente,flujoValidarDestino
    const adapterFlow = createFlow([flowPrincipal,flujoNombrePropio,flujoValidarOtro,flujoValidarDestino,flujoInicial,flowWelcome, flowVoice,flujoSeleccionMultiplesCoincidencias,flujoSeleccionMultiplesCoincidencias2,flujoSeleccionManualOBusqueda,Nuevapersona])
    const adapterProvider = createProvider(BaileysProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    QRPortalWeb()
}

main()
