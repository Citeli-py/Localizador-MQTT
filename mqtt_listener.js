
// Lidar com clientes e mapas

class Clientes {

    constructor(){
        this.clientes = new Map();
        this.lastId = 0;
    }

    addCliente(nome){

        console.log(`Cliente novo ${nome}:${this.lastId}`);
        this.clientes.set(this.lastId, {
            "id"          : this.lastId,
            "nome"        : nome,
            "coordenadas" : null,
            "marker"      : null,
        });
        this.lastId ++;
    }

    updateCliente(id, coordenadas){

        var cliente = this.clientes.get(id);
        if(!cliente.coordenadas||(coordenadas[0] !== cliente.coordenadas[0] || coordenadas[1] !== cliente.coordenadas[1])){
            var marker = L.marker(coordenadas).addTo(mymap);
            
            marker.bindPopup(cliente.nome);
            console.log(`Cliente ${cliente.nome} mudou para a posicao ${coordenadas}`);

            if (cliente.marker != null) {
                mymap.removeLayer(cliente.marker);
            }
            
            this.clientes.set(cliente.id, {
                "id"          : cliente.id,
                "nome"        : cliente.nome,
                "coordenadas" : coordenadas,
                "marker"      : marker,
            });
            
            cliente.coordenadas = coordenadas;
        }
    }
}

var tabelaClientes = new Clientes();
var client, topico;

function conectar(sala) {
    // Configurações do broker MQTT
    const broker = "wss://37ee3b382c624c81ba97e0c176dfefcf.s2.eu.hivemq.cloud:8884/mqtt"
    const options = {
        username: "Cliente",
        password: 'Ac57f8d56dfb28da7f7fc5dd99b64a7a223ae23ae3ef9f3a9ace3ccdeaad6aa22',
        //clientId: "",
    };

    topico = sala;
    // Cria um novo cliente MQTT
    client = mqtt.connect(broker, options);

    client.on('connect', function () {
        console.log('Conectado ao broker MQTT');
        subscribe(topico);
    });

    client.on('message', function (topic, message) {
        // Chama a função handleMessage com o tópico e a mensagem
        handleMessage(topic, message.toString());
    });

    client.on('error', (err) => {
        console.error('Erro ao conectar com o Broker MQTT:', err);
    });
}


// Função para lidar com mensagens recebidas

/*
    ?nome                   => Pedir ID
    id>latitude,longitude   => Enviar localização
    ?nome:id                => Resposta do listener para o ID

    !id>eleicao             => o ID pede uma eleição
    !id>OK!                 => Respostas de que a eleição falhou
    !id>VITORIA             => ID venceu a eleição
*/

function handleMessage(topic, message) {

    if(topic === topico) {
        console.log(message);

        let regex_id = /\?([a-z A-z 0-9]+)/;
        let match = message.match(regex_id);    

        if (match && !message.includes(":")) {
            publish(topico, `?${match[1]}:${tabelaClientes.lastId}`);
            tabelaClientes.addCliente(match[1]);
        }

        if(message.includes(">")){
            list_message = message.split(">");
            id = Number(list_message[0]);
            
            if (id !== null) {
                coordenadas = list_message[1].split(',');
                coordenadas = [Number(coordenadas[0]), Number(coordenadas[1])];
                tabelaClientes.updateCliente(id, coordenadas);
            }
        }
    }
}

// Função para publicar uma mensagem
function publish(topic, message) {
    client.publish(topic, message, function (err) {
        if (err) {
            console.log('Erro ao publicar a mensagem: ' + err);
        }
    });
 }

// Função para se inscrever em um tópico
function subscribe(topic) {
   client.subscribe(topic, function (err) {
       if (err) {
           console.log('Erro ao se inscrever no tópico: ' + err);
       }
   });

   console.log("Inscrito em " + topic);
}
