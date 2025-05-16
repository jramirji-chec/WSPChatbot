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



// const usersData = {}; // Almacén temporal de datos de usuarios
// const csvFilePath = "reportes.csv"; // Ruta del archivo CSV
const jsonFilePath = path.join(__dirname, "reportes.json"); // Ruta del archivo JSON

//const csvFilePath = path.join(__dirname, "reportes.csv");
const usersData = {}; // Almacén temporal de datos de usuarios



// prueba
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
        { delay: 2000, capture: true },
        async (ctx, { gotoFlow, fallBack }) => {
            const opcion = ctx.body.trim();

            if (opcion === '1') {
                return gotoFlow(flujoNombrePropio);
            } else if (opcion === '2') {
                return gotoFlow(flujoValidarRemitente);
            } else {
                return fallBack("Opción no válida. Por favor, responde con 1 o 2.");
            }
        }
    );

// // Flujo para continuar si es un reporte a nombre propio
// const flujoNombrePropio = addKeyword('flujoPropio')
//     .addAnswer("Por favor, escriba su Nombre y Apellido: ", { delay: 2000, capture: true }, async (ctx, ctxFn) => {
//         const userId = ctx.from;
//         const fechaHora = new Date().toLocaleString("es-ES").replace(",", ""); // Formatear fecha y hora
//         const nombrepersona = ctx.body;
//         const nombreSinAcento = eliminarAcentos(nombrepersona);
        
//         await ctxFn.flowDynamic(`¡Estamos validando tu información, por favor espera un momento...🔄`);
//         await espera(5000);
//         console.log(`Datos recibidos del número: '${userId}'`);
//         console.log(`Nombre: ${ctx.body}`);
//         const nombreBuscado = ctx.body; // Capturar el nombre proporcionado por el usuario
//         //const cedulaBuscada = ctx.body; // Capturar la cédula proporcionada por el usuario

//         try {
//             const resultados = await buscarPorNombre(nombreBuscado); // Consultar los datos por nombre
//             //const resultados = await buscarPorCedula(cedulaBuscada); // Consultar los datos por cédula

//             if (resultados.length > 0) {
//                 // Capturar el primer resultado (o manejar múltiples resultados si es necesario)
//                 const resultado = resultados[0];
//                 const nombreSinAcento = eliminarAcentos(resultado.nombre);

//                 // Almacenar los datos en usersData
//                 usersData[userId] = {
//                     nombre: nombreSinAcento,
//                     cedula: resultado.cedula,
//                     telefono: userId,
//                     fechaHora: new Date().toLocaleString("es-ES").replace(",", ""), // Formatear fecha y hora
//                 };
                
//                 // Mostrar los datos encontrados al usuario
//                 console.log(`Nombre: ${resultado.nombre}`);
//                 await ctxFn.flowDynamic(`¡Hola, *${resultado.nombre}*! 😊`);
//                 console.log(`Cedula: ${resultado.cedula}`);
//                 await ctxFn.flowDynamic(`¡Tu usuario es: *${resultado.usuario}*`);
//                 console.log(`Usuario: ${resultado.usuario}`);
//                 usersData[userId].codigo = resultado.usuario; // Guardar el código de usuario
//                 await espera(2000); 
                
//                 await ctxFn.flowDynamic("Ahora, envíame una nota de voz que sea clara y pausada, describiendo tu reporte o incidente:");

//             } else {
//                 await ctxFn.flowDynamic("No se encontraron datos para la cédula proporcionada.");
//                 await ctxFn.flowDynamic("Por favor valida con tu jefe inmediato o la persona encargada.");
//                 await ctxFn.flowDynamic("Te esperamos pronto! 👋.");
//             }
//         } catch (error) {
//             console.error("Error al buscar datos:", error);
//             await ctxFn.flowDynamic("Ocurrió un error al buscar los datos. Por favor, intenta más tarde.");
//         }
//     })

const flujoNombrePropio = addKeyword('flujoPropio')
.addAnswer("Por favor, indícame tu Nombre y Apellido para validar los datos:", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const nombre = eliminarAcentos(ctx.body.trim());

        await flowDynamic("Estamos validando tu información, por favor espera un momento...🔄");
        await espera(3000);

        const resultados = await buscarPorNombre(nombre);

        if (resultados.length === 0) {
            await flowDynamic("❌ No se encontraron datos. Por favor verifica el nombre o contacta a soporte.");
            return;
        }

        if (resultados.length === 1) {
            return await procesarCoincidenciaUnica(resultados[0], userId, flowDynamic, gotoFlow);
        }

        //return await procesarMultiplesCoincidencias(resultados, state, flowDynamic);
    })

    .addAnswer("Procesando...", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const seleccion = parseInt(ctx.body.trim());
        const posibles = await state.get("posiblesCoincidencias");
        console.log("ID de usuario:", userId);
        console.log("Selección del usuario:", seleccion);  
        console.log("Posibles coincidencias:", posibles); 
    

        if (!posibles || isNaN(seleccion) || seleccion < 1 || seleccion > posibles.length) {
            await flowDynamic("❌ Opción inválida. Por favor escribe el número correcto de la lista mostrada.");
            return;
        }

        const seleccionado = posibles[seleccion - 1];
        return await procesarCoincidenciaUnica(seleccionado, userId, flowDynamic, gotoFlow);
    });

async function procesarCoincidenciaUnica(resultado, userId, flowDynamic, gotoFlow) {
    usersData[userId] = {
        remitente: {
            nombre: resultado.nombre,
            cedula: resultado.cedula,
            codigo: resultado.usuario
        }
    };

    await flowDynamic(`✅ ¡Hola, *${resultado.nombre}*!\nTu cédula es: *${resultado.cedula}*\nTu código es: *${resultado.usuario}*`);
    //return gotoFlow(flujoValidarDestino);
}

async function procesarMultiplesCoincidencias(resultados, state, flowDynamic) {
    const opcionesTexto = resultados.map((r, i) => `*${i + 1}*. ${r.nombre}`).join('\n');
    await flowDynamic(`⚠️ Se encontraron múltiples coincidencias. Por favor selecciona tu número de la lista:\n\n${opcionesTexto}`);
    await state.update({ posiblesCoincidencias: resultados });
}

// Paso 3: flujo para validar al remitente
// const flujoValidarRemitente = addKeyword('validarRemitente')
//     .addAnswer("Por favor, indícame tu Nombre y Apellido para validar los datos:", { capture: true }, async (ctx, { gotoFlow, flowDynamic }) => {
//         const userId = ctx.from;
//         const nombre = eliminarAcentos(ctx.body.trim());

//         await flowDynamic("Estamos validando tu información, por favor espera un momento...🔄");
//         await espera(3000);

//         //const resultado = await buscarPorNombre(nombre);
//         //console.log(resultado); // Muestra todos los "cesar augusto ..." existentes
//         const resultados = await buscarPorNombre(nombre);
//         if (resultados.length > 0) {
//             //const r = resultados[0];
//             const r = resultados
//             usersData[userId] = {
//                 remitente: {
//                     nombre: r.nombre,
//                     cedula: r.cedula,
//                     codigo: r.usuario
//                 }
//             };

//             await flowDynamic(`¡Hola, *${r.nombre}*`);
//             await flowDynamic(`¡Tu cédula es: *${r.cedula}*`);
//             await flowDynamic(`¡Tú código es: *${r.usuario}*`);
//             return gotoFlow(flujoValidarDestino);
//         } else {
//             await flowDynamic("No se encontraron datos. Por favor verifica el nombre o contacta a soporte.");
//         }
//     });

const flujoValidarRemitente = addKeyword('validarRemitente')
    .addAnswer("Por favor, indícame tu Nombre y Apellido para validar los datos:", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const nombre = eliminarAcentos(ctx.body.trim());

        await flowDynamic("Estamos validando tu información, por favor espera un momento...🔄");
        await espera(3000);

        const resultados = await buscarPorNombre(nombre);


        if (resultados.length === 0) {
            await flowDynamic("❌ No se encontraron datos. Por favor verifica el nombre o contacta a soporte.");
            return;
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

            await flowDynamic(`✅ ¡Hola, *${r.nombre}*!\nTu cédula es: *${r.cedula}*\nTu código es: *${r.usuario}*`);
            return gotoFlow(flujoValidarDestino);
        }

        // Hay más de un resultado, mostrar opciones
        let opcionesTexto = resultados.map((r, i) => `*${i + 1}*. ${r.nombre}`).join('\n');
        await flowDynamic(`⚠️ Se encontraron múltiples coincidencias. Por favor selecciona tu número de la lista:\n\n${opcionesTexto}`);

        // Guardar temporalmente en estado para uso en respuesta
        await state.update({ posiblesCoincidencias: resultados });

        // Espera la respuesta del usuario con el número seleccionado
        return;
    })
    // Capturar la selección del usuario si hay múltiples opciones
    .addAnswer("Procesando...", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
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
        return gotoFlow(flujoValidarDestino);
    });


// Paso 4: flujo para validar destinatario del reporte
const flujoValidarDestino = addKeyword('validarDestino')
    .addAnswer("Ahora: ¿Cuál es el *Nombre Completo* de la persona para quien haces el reporte?", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
        const userId = ctx.from;
        const nombre = eliminarAcentos(ctx.body.trim());

        await flowDynamic("Buscando los datos de esta persona...🔍");
        await espera(3000);

        const resultados = await buscarPorNombre(nombre);
        if (resultados.length === 0) {
            await flowDynamic("❌ No se encontraron datos. Por favor verifica el nombre o contacta a soporte.");
            return;
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

        // Hay más de un resultado, mostrar opciones
        let opcionesTexto = resultados.map((r, i) => `*${i + 1}*. ${r.nombre}`).join('\n');
        await flowDynamic(`⚠️ Se encontraron múltiples coincidencias. Por favor selecciona tu número de la lista:\n\n${opcionesTexto}`);

        // Guardar temporalmente en estado para uso en respuesta
        await state.update({ posiblesCoincidencias: resultados });

        // Espera la respuesta del usuario con el número seleccionado
        return;
    })
    // Capturar la selección del usuario si hay múltiples opciones
    .addAnswer("Procesando...", { capture: true }, async (ctx, { gotoFlow, flowDynamic, state }) => {
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
        
        // Aquí puedes continuar con la lógica de nota de voz o el incidente
            await espera(1000);
            await flowDynamic("Ahora, por favor envíame una *nota de voz* con el reporte del incidente.");

        //     // Si deseas generar un JSON final
        //     const jsonFinal = {
        //         telefono: userId,
        //         fechaHora: new Date().toLocaleString("es-ES"),
        //         remitente: usersData[userId].remitente,
        //         destinatario: usersData[userId].destinatario
        //     };
        //     console.log("🚀 JSON generado:", jsonFinal);
        // } else {
        //     await flowDynamic("No se encontraron datos. Por favor valida el nombre.");
        // }
});
    //     if (resultados.length > 0) {
    //         const r = resultados[0];
    //         usersData[userId].destinatario = {
    //             nombre: r.nombre,
    //             cedula: r.cedula,
    //             codigo: r.usuario
    //         };

    //         await flowDynamic(`Reporte de: *${usersData[userId].remitente.nombre}*`);
    //         await flowDynamic(`Para: *${r.nombre}*`);
    //         await flowDynamic(`¡Su cédula es: *${r.cedula}*`);
    //         await flowDynamic(`¡Su código es: *${r.usuario}*`);

    //         // Aquí puedes continuar con la lógica de nota de voz o el incidente
    //         await espera(1000);
    //         await flowDynamic("Ahora, por favor envíame una *nota de voz* con el reporte del incidente.");

    //         // Si deseas generar un JSON final
    //         const jsonFinal = {
    //             telefono: userId,
    //             fechaHora: new Date().toLocaleString("es-ES"),
    //             remitente: usersData[userId].remitente,
    //             destinatario: usersData[userId].destinatario
    //         };
    //         console.log("🚀 JSON generado:", jsonFinal);
    //     } else {
    //         await flowDynamic("No se encontraron datos. Por favor valida el nombre.");
    //     }
    // });

// Flujo para continuar si es un reporte a nombre de otra persona
// const flujoOtraPersona = addKeyword('flujoOtra')
    
//     //.addAnswer("Muy bien, vas a reportar a nombre de otra persona. Por favor, indícame el nombre de esa persona.");
//     .addAnswer("Por favor, indica el Nombre y Apellido de la otra persona: ", { delay: 2000, capture: true }, async (ctx, ctxFn) => {
//         const userId = ctx.from;
//         const fechaHora = new Date().toLocaleString("es-ES").replace(",", ""); // Formatear fecha y hora
//         const nombrepersona = ctx.body;
//         const nombreSinAcento = eliminarAcentos(nombrepersona);
        
//         await ctxFn.flowDynamic(`¡Estamos validando la información, por favor espera un momento...🔄`);
//         await espera(5000);
//         console.log(`Datos recibidos del número: '${userId}'`);
//         console.log(`Nombre: ${ctx.body}`);
//         const nombreBuscado = ctx.body; // Capturar el nombre proporcionado por el usuario
//         //const cedulaBuscada = ctx.body; // Capturar la cédula proporcionada por el usuario

//         try {
//             const resultados = await buscarPorNombre(nombreBuscado); // Consultar los datos por nombre
//             //const resultados = await buscarPorCedula(cedulaBuscada); // Consultar los datos por cédula

//             if (resultados.length > 0) {
//                 // Capturar el primer resultado (o manejar múltiples resultados si es necesario)
//                 const resultado = resultados[0];
//                 const nombreSinAcento = eliminarAcentos(resultado.nombre);

//                 // Almacenar los datos en usersData
//                 usersData[userId] = {
//                     nombre: nombreSinAcento,
//                     cedula: resultado.cedula,
//                     telefono: userId,
//                     fechaHora: new Date().toLocaleString("es-ES").replace(",", ""), // Formatear fecha y hora
//                 };
                
//                 // Mostrar los datos encontrados al usuario
//                 console.log(`Nombre: ${resultado.nombre}`);
//                 await ctxFn.flowDynamic(`¡Hola, *${resultado.nombre}*! 😊`);
//                 console.log(`Cedula: ${resultado.cedula}`);
//                 await ctxFn.flowDynamic(`¡Tu usuario es: *${resultado.usuario}*`);
//                 console.log(`Usuario: ${resultado.usuario}`);
//                 usersData[userId].codigo = resultado.usuario; // Guardar el código de usuario
//                 await espera(2000); 
                
//                 await ctxFn.flowDynamic("Ahora, envíame una nota de voz que sea clara y pausada, describiendo tu reporte o incidente:");

//             } else {
//                 await ctxFn.flowDynamic("No se encontraron datos para el Nombre proporcionado.");
//                 await ctxFn.flowDynamic("Por favor valida con tu jefe inmediato o la persona encargada.");
//                 await ctxFn.flowDynamic("Te esperamos pronto! 👋.");
//             }
//         } catch (error) {
//             console.error("Error al buscar datos:", error);
//             await ctxFn.flowDynamic("Ocurrió un error al buscar los datos. Por favor, intenta más tarde.");
//         }
//     })


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
                        "Si estás de acuerdo con la transcripción, responde con:\n1️⃣ Sí, estoy de acuerdo.\n2️⃣ No, quiero volver a enviarla.",
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
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowPrincipal,flujoNombrePropio,flujoValidarRemitente,flujoValidarDestino,flujoInicial,flowWelcome, flowVoice])
    const adapterProvider = createProvider(BaileysProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    QRPortalWeb()
}

main()
